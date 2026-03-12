// ============================================================================
// MY REQUEST MODULE (Material Request for Production Operations)
// ============================================================================
// ✅ REFACTORED: Separated from MaterialOperation.tsx into standalone file
// This module manages material requests for production operations:
// - Create material requests for production operations
// - Track status: Request to Warehouse → Issued by Warehouse → Received by Production
// - Warehouse issues materials, production receives them
// - Supports shortage scenarios and auto-procurement
// ============================================================================

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  type MRRequest, 
  type MRItem, 
  type MRStatus, 
  mockMRRequests, 
  addMRRequest, 
  updateMRRequest,
  getMRRequestById 
} from "@/lib/mrSharedData";

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

// Mock operation-to-item mapping (BOM-like data)
const OPERATION_MAPPINGS: OperationMapping[] = [
  {
    operation: "Lead Generation & Purification",
    workCenter: "Lead Furnace Center",
    items: [
      { itemCode: "rm-1", itemName: "Scrap Battery", uom: "KG", standardQty: 100 },
    ]
  },
  {
    operation: "Case Creation",
    workCenter: "Plastic Casing Center",
    items: [
      { itemCode: "rm-2", itemName: "Plastic Pallets", uom: "KG", standardQty: 50 },
    ]
  },
  {
    operation: "Grid Creation & Oxidization",
    workCenter: "Grid Generation Center",
    items: [
      { itemCode: "sfg-1", itemName: "Purified Lead", uom: "KG", standardQty: 10 },
    ]
  },
  {
    operation: "Assembly line & Packaging",
    workCenter: "Assembly Line",
    items: [
      { itemCode: "sfg-2", itemName: "Battery Cases", uom: "NOS", standardQty: 1 },
      { itemCode: "sfg-3", itemName: "Battery Lids", uom: "NOS", standardQty: 1 },
      { itemCode: "rm-3", itemName: "Acid Type A", uom: "LTR", standardQty: 5 },
    ]
  },
];

// Mock warehouse stock data
const WAREHOUSE_STOCK: { [warehouse: string]: { [itemCode: string]: number } } = {
  "Jinja WH": {
    "rm-1": 1500,
    "rm-2": 500,
    "rm-3": 200,
    "sfg-1": 300,
    "sfg-2": 100,
    "sfg-3": 100,
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MyRequest() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Removed route-based New MR Request page; now opened as modal from My Request list
  // Modal state for New/Edit MR Request form
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ============================================================================
  // STATE
  // ============================================================================

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // Pagination state - using DataTablePagination component
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState("Requested to Warehouse");
  const [operationFilter, setOperationFilter] = useState("All");

  // Modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingMR, setViewingMR] = useState<MRRequest | null>(null);
  const [showShortageDialog, setShowShortageDialog] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Validation state
  const [qtyValidationErrors, setQtyValidationErrors] = useState<Record<string | number, string>>({});

  // Sample MR Requests data - using shared data
  const [mrRequests, setMrRequests] = useState<MRRequest[]>(mockMRRequests);

  // Form data state
  const [formData, setFormData] = useState<Partial<MRRequest>>({
    mrNo: `MR-${new Date().getFullYear()}-${String(mrRequests.length + 1).padStart(3, '0')}`,
    date: getCurrentDateForInput(),
    requestedBy: "Current User",
    requiredByDate: getCurrentDateForInput(),
    operation: "",
    workCenter: "",
    warehouse: "Jinja WH",
    shift: "",
    items: []
  });

  // ============================================================================
  // EFFECTS - Form initialization now handled in handleOpenNewForm
  // ============================================================================

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleOperationChange = (operation: string) => {
    const mapping = OPERATION_MAPPINGS.find(m => m.operation === operation);
    if (mapping) {
      const workCenter = mapping.workCenter;
      const items: MRItem[] = mapping.items.map((item, index) => ({
        id: index + 1,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        availableQty: WAREHOUSE_STOCK[formData.warehouse || "Jinja WH"]?.[item.itemCode] || 0,
        requiredQty: item.standardQty
      }));
      setFormData({ ...formData, operation, workCenter, items });
      setQtyValidationErrors({});
    } else {
      setFormData({ ...formData, operation, items: [] });
      setQtyValidationErrors({});
    }
  };

  const handleWarehouseChange = (warehouse: string) => {
    const updatedItems = formData.items?.map(item => ({
      ...item,
      availableQty: WAREHOUSE_STOCK[warehouse]?.[item.itemCode] || 0
    })) || [];
    setFormData({ ...formData, warehouse, items: updatedItems });
  };

  const handleRequiredQtyChange = (itemId: number, newQty: number) => {
    let error = "";
    if (newQty <= 0) {
      error = "Must be greater than 0";
    } else if (newQty > 999999) {
      error = "Maximum 6 digits allowed";
    }
    setQtyValidationErrors(prev => ({ ...prev, [itemId]: error }));
    const updatedItems = formData.items?.map(item =>
      item.id === itemId ? { ...item, requiredQty: newQty } : item
    ) || [];
    setFormData({ ...formData, items: updatedItems });
  };

  const hasShortage = (): boolean => {
    return formData.items?.some(item => item.requiredQty > item.availableQty) || false;
  };

  const handleSubmit = () => {
    if (!formData.requiredByDate) {
      toast({ variant: "destructive", title: "Validation Error", description: "Required By Date is required" });
      return;
    }
    if (!formData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
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
    if (hasShortage()) {
      setShowShortageDialog(true);
    } else {
      submitMRRequest();
    }
  };

  const submitMRRequest = () => {
    const newMR: MRRequest = {
      id: editingId || mrRequests.length + 1,
      mrNo: formData.mrNo!,
      date: formData.date!,
      requiredByDate: formData.requiredByDate!,
      operation: formData.operation!,
      workCenter: formData.workCenter!,
      warehouse: formData.warehouse!,
      requestedBy: formData.requestedBy!,
      status: "Requested to Warehouse",
      shift: formData.shift!,
      items: formData.items ?? []
    };

    if (editingId) {
      updateMRRequest(editingId, newMR);
      toast({ title: "Success", description: "MR Request updated successfully" });
    } else {
      addMRRequest(newMR);
      toast({ title: "Success", description: "MR Request created successfully" });
    }
    setMrRequests([...mockMRRequests]);
    setShowShortageDialog(false);
    handleCloseForm(); // Close modal instead of navigating
  };

  const handleView = (id: number) => {
    const mr = mrRequests.find(m => m.id === id);
    if (mr) {
      setViewingMR(mr);
      setIsViewModalOpen(true);
    }
  };

  const handleMarkAsReceived = () => {
    if (!viewingMR || viewingMR.status !== "Issued by Warehouse") return;
    
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

    // Default receivedQty to issuedQty if not set
    const updatedItems = viewingMR.items.map(item => ({
      ...item,
      receivedQty: item.receivedQty ?? item.issuedQty ?? 0
    }));

    const updatedRequest: MRRequest = {
      ...viewingMR,
      status: "Received by Production",
      receivedDate: new Date().toISOString(),
      receivedBy: "Current User",
      items: updatedItems,
    };

    updateMRRequest(viewingMR.id, updatedRequest);
    setMrRequests([...mockMRRequests]);
    setIsViewModalOpen(false);
    setViewingMR(null);
    toast({
      title: "Success",
      description: `MR ${viewingMR.mrNo} marked as received.`,
    });
  };

  // MR Request form logic unchanged; only UI container changed to Modal
  const handleOpenNewForm = () => {
    setEditingId(null);
    setFormData({
      mrNo: `MR-${new Date().getFullYear()}-${String(mrRequests.length + 1).padStart(3, '0')}`,
      date: getCurrentDateForInput(),
      requestedBy: "Current User",
      requiredByDate: getCurrentDateForInput(),
      operation: "",
      workCenter: "",
      warehouse: "Jinja WH",
      shift: "",
      items: []
    });
    setIsFormModalOpen(true);
  };

  const handleEdit = (id: number) => {
    const existingMR = mrRequests.find(mr => mr.id === id);
    if (existingMR) {
      setEditingId(id);
      setFormData({
        mrNo: existingMR.mrNo,
        date: existingMR.date,
        requestedBy: existingMR.requestedBy,
        requiredByDate: existingMR.requiredByDate,
        operation: existingMR.operation,
        workCenter: existingMR.workCenter,
        warehouse: existingMR.warehouse,
        shift: existingMR.shift,
        items: existingMR.items
      });
      setQtyValidationErrors({});
      setIsFormModalOpen(true);
    }
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setEditingId(null);
    setFormData({
      mrNo: `MR-${new Date().getFullYear()}-${String(mrRequests.length + 1).padStart(3, '0')}`,
      date: getCurrentDateForInput(),
      requestedBy: "Current User",
      requiredByDate: getCurrentDateForInput(),
      operation: "",
      workCenter: "",
      warehouse: "Jinja WH",
      items: []
    });
  };

  const handleDelete = () => {
    if (editingId) {
      const updatedRequests = mrRequests.filter(mr => mr.id !== editingId);
      setMrRequests(updatedRequests);
      toast({ title: "Success", description: "MR Request deleted successfully" });
      setIsDeleteOpen(false);
      handleCloseForm();
    }
  };

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  const filteredRequests = mrRequests.filter(item => {
    const matchesSearch = item.mrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.operation.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = true;
    if (statusFilter !== "All") {
      matchesStatus = item.status === statusFilter;
    }
    const matchesOperation = operationFilter === "All" || item.operation === operationFilter;
    return matchesSearch && matchesStatus && matchesOperation;
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedData = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Auto-adjust page when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredRequests.length, currentPage, totalPages]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, operationFilter]);

  // ============================================================================
  // RENDER - LISTING VIEW WITH MODAL FORM
  // ============================================================================

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My Request</h1>
        <p className="text-muted-foreground">
          Manage material requests for production operations
        </p>
      </div>

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
            options={["Requested to Warehouse", "Issued by Warehouse", "Received by Production"]}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-auto">
          <Button onClick={handleOpenNewForm} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            My Request
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
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">MR Number</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No My Requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((request) => (
                    <TableRow key={request.id} className="hover:bg-muted/30 transition-colors border-b">
                      <TableCell className="py-4 font-medium font-mono">{request.mrNo}</TableCell>
                      <TableCell>{formatDate(request.date)}</TableCell>
                      <TableCell>{request.shift}</TableCell>
                      <TableCell>{request.operation}</TableCell>
                      <TableCell>{request.workCenter}</TableCell>
                      <TableCell>{request.warehouse}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            request.status === "Requested to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                            request.status === "Issued by Warehouse" && "border-blue-500 text-blue-600 bg-blue-50",
                            request.status === "Received by Production" && "border-green-500 text-green-600 bg-green-50"
                          )}
                        >
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => handleView(request.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {request.status === "Requested to Warehouse" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-primary"
                            onClick={() => handleEdit(request.id)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination - Same position as Materials reference */}
          {filteredRequests.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredRequests.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              options={[10, 15, 30, 50]}
            />
          )}
        </CardContent>
      </Card>

      {/* View MR Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Material Request: {viewingMR?.mrNo}</DialogTitle>
          </DialogHeader>

          {viewingMR && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>MR Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>MR Number</Label>
                      <Input value={viewingMR.mrNo} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input value={formatDate(viewingMR.date)} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Requested By</Label>
                      <Input value={viewingMR.requestedBy} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input value="Production" readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Required By Date</Label>
                      <Input value={formatDate(viewingMR.requiredByDate)} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Shift</Label>
                      <Input value={viewingMR.shift} readOnly className="bg-muted" />
                    </div>
                    {viewingMR.status === "Received by Production" && viewingMR.receivedDate && (
                      <div>
                        <Label>Received Date</Label>
                        <Input value={formatDate(viewingMR.receivedDate)} readOnly className="bg-muted" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Selection Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Operation</Label>
                      <Input value={viewingMR.operation} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Work Center</Label>
                      <Input value={viewingMR.workCenter} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Warehouse</Label>
                      <Input value={viewingMR.warehouse} readOnly className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                            {viewingMR.status !== "Requested to Warehouse" && (
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
                              {viewingMR.status !== "Requested to Warehouse" && (
                                <>
                                  <TableCell className="text-right">{item.issuedQty || 0}</TableCell>
                                  <TableCell className="text-right">
                                    {viewingMR.status === "Received by Production" ? (
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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            {viewingMR && viewingMR.status === "Issued by Warehouse" && (
              <Button onClick={handleMarkAsReceived} variant="default">
                Received
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shortage Dialog */}
      <AlertDialog open={showShortageDialog} onOpenChange={setShowShortageDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Material Shortage Detected</AlertDialogTitle>
            <AlertDialogDescription>
              Some items have required quantity greater than available quantity. A procurement request will be automatically created for shortage items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitMRRequest}>
              Continue & Create PR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MR Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this MR Request? This action cannot be undone.
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

      {/* New/Edit MR Request Form Modal */}
      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-2xl font-bold">
              {editingId ? "Edit MR Request" : "New MR Request"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>MR Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>MR Number</Label>
                    <Input value={formData.mrNo} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Required By Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={formData.requiredByDate} onChange={(e) => setFormData({ ...formData, requiredByDate: e.target.value })} />
                  </div>
                  <SearchableSelect
                    label="Operation"
                    required
                    value={formData.operation}
                    options={OPERATIONS}
                    onChange={handleOperationChange}
                  />
                  <SearchableSelect
                    label="Work Center"
                    required
                    value={formData.workCenter}
                    options={WORK_CENTERS}
                    onChange={(val) => setFormData({ ...formData, workCenter: val })}
                  />
                  <SearchableSelect
                    label="Warehouse"
                    required
                    value={formData.warehouse}
                    options={WAREHOUSES}
                    onChange={handleWarehouseChange}
                  />
                  <SearchableSelect
                    label="Shift"
                    required
                    value={formData.shift}
                    options={["Morning", "Night"]}
                    onChange={(val) => setFormData({ ...formData, shift: val })}
                  />
                </div>

              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Material Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Available Qty</TableHead>
                        <TableHead className="text-right w-32">Required Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            Select an operation to load materials
                          </TableCell>
                        </TableRow>
                      ) : (
                        formData.items?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell className="text-right">{item.availableQty}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                className={cn(
                                  "h-8 text-right",
                                  qtyValidationErrors[item.id as any] && "border-destructive focus-visible:ring-destructive"
                                )}
                                value={item.requiredQty}
                                onChange={(e) => handleRequiredQtyChange(item.id as any, parseFloat(e.target.value) || 0)}
                              />
                              {qtyValidationErrors[item.id as any] && (
                                <p className="text-[10px] text-destructive mt-1">{qtyValidationErrors[item.id as any]}</p>
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
          </div>

          <DialogFooter className="p-6 border-t">
            <Button variant="outline" onClick={handleCloseForm}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update Request" : "Save Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
