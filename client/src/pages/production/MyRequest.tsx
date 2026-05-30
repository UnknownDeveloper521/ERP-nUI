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

import { useState, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Trash2, Calendar as CalendarIcon, ChevronDown, X, Play, Clock, CheckCircle2, AlertCircle, FileText, Send, User, Loader2 } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
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
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";
import { useCommonStore } from "@/store/commonStore";
import { commonApi, productionApi, hrCommonApi } from "@/lib/api";
import { format, parse } from "date-fns";
import { INITIAL_PLANS } from "@/lib/productionPlanSharedData";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
  getAssignedIds,
  getFirstAssignedMatch,
  prioritizeByAssigned,
} from "@/utils/assignedDropdown";

/** Green styling for successful actions; keep errors as destructive. */
const crudSuccessToast = {
  className:
    "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

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

const parseDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const resolveOperationCode = (
  opId: number | string,
  op: { code?: string } | undefined,
  records: { id: number; code?: string; operation_code?: string }[]
): string => {
  const listOp = records.find((lo) => String(lo.id) === String(opId));
  return String(
    listOp?.operation_code ||
    listOp?.code ||
    op?.code ||
    ""
  ).trim();
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MyRequest() {
  const { isMenuVisible, canCreate, canEdit, canView } = useHasPermission();
  const permissionModule = "PRODUCTION/MY_REQUEST";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Removed route-based New MR Request page; now opened as modal from My Request list
  // Modal state for New/Edit MR Request form
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formDialogEl, setFormDialogEl] = useState<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ============================================================================
  // STATE
  // ============================================================================

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [operationFilter, setOperationFilter] = useState("All");
  const appliedOperationFilterDefault = useRef(false);
  const appliedStatusFilterDefault = useRef(false);
  const [areListFiltersReady, setAreListFiltersReady] = useState(
    () => getAssignedIds("operation").length === 0
  );
  const [shiftFilter, setShiftFilter] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [isListLoading, setIsListLoading] = useState(false);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpening, setIsFormOpening] = useState(false);
  const [openingMRId, setOpeningMRId] = useState<number | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [listOperations, setListOperations] = useState<{ id: number; name: string; code?: string; operation_code?: string }[]>([]);
  const [formOperations, setFormOperations] = useState<any[]>([]);
  const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [activePlans, setActivePlans] = useState<{ id: number; code: string }[]>([]);
  const [operationMappings, setOperationMappings] = useState<any[]>([]);

  const assignedWorkcenterIds = getAssignedIds("workcenter");
  const assignedOperationIds = getAssignedIds("operation");
  const assignedWarehouseIds = getAssignedIds("warehouse");

  const orderedWorkCenters = useMemo(
    () => prioritizeByAssigned(workCenters, assignedWorkcenterIds, (wc) => wc.id),
    [workCenters, assignedWorkcenterIds]
  );

  const orderedWarehouses = useMemo(
    () => prioritizeByAssigned(warehouses, assignedWarehouseIds, (wh) => wh.id),
    [warehouses, assignedWarehouseIds]
  );

  const defaultWarehouseIdStr = useMemo(() => {
    if (orderedWarehouses.length === 0) return "";
    if (assignedWarehouseIds.length > 0) {
      const first = getFirstAssignedMatch(
        assignedWarehouseIds,
        orderedWarehouses.map((wh) => wh.id),
      );
      if (first) return String(first);
    }
    return String(orderedWarehouses[0].id);
  }, [orderedWarehouses, assignedWarehouseIds]);

  const orderedListOperations = useMemo(
    () => prioritizeByAssigned(listOperations, assignedOperationIds, (op) => op.id),
    [listOperations, assignedOperationIds]
  );

  const orderedFormOperations = useMemo(
    () => prioritizeByAssigned(formOperations, assignedOperationIds, (op) => op.id),
    [formOperations, assignedOperationIds]
  );

  const operationSelectOptions = useMemo(
    () =>
      orderedFormOperations.map((op) => {
        const name = String(op.name || "").trim();
        const code =
          resolveOperationCode(op.id, op, listOperations) ||
          `OP${String(op.id).padStart(3, "0")}`;
        return {
          value: String(op.id),
          label: `${name} — ${code}`,
          primaryText: name,
          secondaryText: code,
        };
      }),
    [orderedFormOperations, listOperations]
  );

  // Get master data from global common store
  const mrStatuses = useCommonStore(s => s.mrStatuses);

  // Modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingMR, setViewingMR] = useState<any>(null);
  const [showShortageDialog, setShowShortageDialog] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Validation state
  const [qtyValidationErrors, setQtyValidationErrors] = useState<Record<string | number, string>>({});

  // Sample MR Requests data - using shared data
  const [mrRequests, setMrRequests] = useState<any[]>([]);

  // Form data state
  const [formData, setFormData] = useState<any>({
    mrNo: "",
    date: getCurrentDateForInput(),
    requestedBy: "Current User",
    requiredByDate: getCurrentDateForInput(),
    operation_id: "",
    work_center_id: "",
    shift_id: "",
    production_plan_id: "",
    items: []
  });

  // ============================================================================
  // FETCH LOGIC
  // ============================================================================

  const pickWarehouseFields = (comp: any) => {
    const warehouseId =
      comp.warehouse_id ??
      comp.warehouseId ??
      comp.warehouse?.id ??
      comp.warehouse?.warehouse_id;
    const warehouseName = String(
      comp.warehouse_name ??
        comp.warehouseName ??
        comp.warehouse?.name ??
        comp.warehouse?.warehouse_name ??
        "",
    ).trim();
    return { warehouse_id: warehouseId, warehouse_name: warehouseName };
  };

  const resolveWarehouseName = (warehouseId: unknown, fallbackName?: string) => {
    if (fallbackName?.trim()) return fallbackName.trim();
    if (warehouseId == null || warehouseId === "") return "";
    const match = orderedWarehouses.find((wh) => String(wh.id) === String(warehouseId));
    return match?.name ?? "";
  };

  const appendOperationComponents = (
    target: any[],
    components: any[],
    getQty: (c: any) => number
  ) => {
    (components || []).forEach((comp: any) => {
      if (!comp?.item_id) return;
      if (target.some((o: any) => o.item_id === comp.item_id)) return;
      const warehouse = pickWarehouseFields(comp);
      target.push({
        item_id: comp.item_id,
        availableQty: getQty(comp),
        warehouse_id: warehouse.warehouse_id,
        warehouse_name: resolveWarehouseName(
          warehouse.warehouse_id,
          warehouse.warehouse_name,
        ),
        item: {
          id: comp.item_id,
          name: comp.item_name || "",
          code: comp.item_code || "",
          uom: comp.uom || "",
          type: comp.item_type || "",
        },
      });
    });
  };

  const loadFormOperations = async () => {
    try {
      const res = await commonApi.getOperationsWithOutput();
      if (res.isSuccessful && res.data?.records) {
        const opsMap = new Map<number, any>();
        res.data.records.forEach((record: any) => {
          const opId = record.operation?.operation_id;
          if (!opId) return;

          if (!opsMap.has(opId)) {
            opsMap.set(opId, {
              id: opId,
              name: record.operation?.operation_name || "Unknown Operation",
              code: String(record.operation?.operation_code || record.operation?.code || "").trim(),
              inputs: [],
              outputs: [],
            });
          }

          const op = opsMap.get(opId);
          const inputList = Array.isArray(record.input_components)
            ? record.input_components
            : record.input_component
              ? [record.input_component]
              : [];
          const outputList = Array.isArray(record.output_components)
            ? record.output_components
            : record.output_component
              ? [record.output_component]
              : [];

          appendOperationComponents(op.inputs, inputList, (c) =>
            Number(c.current_qty ?? c.current_QTY ?? 0) || 0
          );
          appendOperationComponents(op.outputs, outputList, (c) =>
            Number(c.current_qty ?? c.current_QTY ?? 0) || 0
          );
        });
        const ops = Array.from(opsMap.values());
        setFormOperations(ops);
        return ops;
      }
    } catch (err) {
      console.error("Failed to load operations with output", err);
    }
    return [];
  };
  const loadFormWorkCenters = async () => {
    try {
      const res = await commonApi.getWorkCenters();
      if (res.isSuccessful && res.data?.records) {
        const mapped = res.data.records.map((wc: any) => ({
          id: wc.id ?? wc.work_center_id,
          name: wc.work_center_name || wc.name || wc.value_name,
        }));
        setWorkCenters(mapped);
        return mapped;
      }
    } catch (err) {
      console.error("Failed to load work centers", err);
    }
    return [];
  };

  const loadFormWarehouses = async () => {
    try {
      const res = await commonApi.getWarehouses();
      if (res.isSuccessful && res.data?.records) {
        const mapped = res.data.records.map((r: any) => ({
          id: r.warehouse_id ?? r.id,
          name: r.warehouse_name || r.name || r.value_name,
        }));
        setWarehouses(mapped);
        return mapped;
      }
    } catch (err) {
      console.error("Failed to load warehouses", err);
    }
    return [];
  };

  const fetchInitialData = async () => {
    try {
      const [opRes, shiftRes] = await Promise.all([
        commonApi.getOperations(),
        productionApi.getShiftForProduction()
      ]);

      if (shiftRes.isSuccessful && shiftRes.data?.records) {
        setShifts(shiftRes.data.records.map((r: any) => ({
          ...r,
          id: r.shift_id || r.id || r.value_id,
          name: r.shift_name || r.name || r.value_name || "Unknown",
          value_name: r.shift_name || r.name || r.value_name || "Unknown",
        })));
      }


      if (opRes.isSuccessful && opRes.data?.records) {
        const operationRecords = opRes.data.records.map((r: any) => ({
          id: r.id ?? r.operation_id,
          name: r.name || r.operation_name,
          code: r.operation_code || r.code,
          operation_code: r.operation_code || r.code,
        }));
        setListOperations(operationRecords);

        if (
          !appliedOperationFilterDefault.current &&
          assignedOperationIds.length > 0 &&
          operationRecords.length > 0
        ) {
          const ordered = prioritizeByAssigned<{ id: number; name: string }>(
            operationRecords,
            assignedOperationIds,
            (o) => o.id
          );
          const firstAssigned = getFirstAssignedMatch(
            assignedOperationIds,
            ordered.map((o) => o.id)
          );
          if (firstAssigned) {
            setOperationFilter(String(firstAssigned));
            appliedOperationFilterDefault.current = true;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setAreListFiltersReady(true);
    }
  };

  const fetchProductionPlans = async (operationId?: string, shiftId?: string) => {
    try {
      const op = operationId || formData.operation_id;
      const sh = shiftId || formData.shift_id;
      
      const res = await commonApi.getProductionPlans({ 
        operation_id: op,
        shift_id: sh,
        status_id: "" // Add specific status if needed
      });
      if (res.isSuccessful && res.data?.records) {
        setActivePlans(res.data.records.map((r: any) => ({
          id: r.production_plan_id,
          code: r.display_name || r.plan_code
        })));
      } else {
        setActivePlans([]);
      }
    } catch (error) {
      console.error("Error fetching production plans:", error);
      setActivePlans([]);
    }
  };

  const fetchRequests = async () => {
    setIsListLoading(true);
    try {
      const response = await productionApi.getMyRequestList({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        operation_id: operationFilter === "All" ? "" : operationFilter,
        shift_id: shiftFilter === "All" ? "" : shiftFilter,
        status_id: statusFilter === "All" ? "" : statusFilter,
        request_date: filterDate ? format(parse(filterDate, "dd-MM-yyyy", new Date()), "yyyy-MM-dd") : ""
      });

      if (response.isSuccessful && response.data?.records) {
        const selectedStatusId = statusFilter !== "All" ? String(statusFilter).trim() : "";
        const selectedStatus = selectedStatusId
          ? mrStatuses.find((s: any) => String(s?.id ?? s?.value_id ?? "").trim() === selectedStatusId)
          : null;
        const selectedStatusName = String(selectedStatus?.value_name || selectedStatus?.name || "")
          .trim()
          .toLowerCase();
        const selectedStatusNameAliases =
          selectedStatusName === "requested to warehouse"
            ? ["requested to warehouse", "request to warehouse"]
            : [selectedStatusName];

        const mappedRequests = response.data.records.map((r: any) => ({
          id: r.id,
          mrNo: r.mr_code,
          date: r.request_date,
          shift: r.shift_name,
          shift_id: r.shift_id,
          operation: r.operation_name,
          operation_id: r.operation_id,
          workCenter: r.work_center_name,
          work_center_id: r.work_center_id,
          warehouse: r.warehouse_name,
          warehouse_id: r.warehouse_id,
          status: r.status_name,
          status_id: r.status_id,
          requestedBy: r.requested_by_name || "System",
          requiredByDate: r.required_by_date || r.request_date,
          productionPlanId: r.production_plan_id,
          items: r.items || []
        }));

        const filteredRequests =
          statusFilter === "All"
            ? mappedRequests
            : mappedRequests.filter((req: any) => {
                const reqStatusId = String(req.status_id ?? "").trim();
                const selStatusId = String(statusFilter).trim();
                
                // Primary check: ID comparison
                if (selStatusId && reqStatusId) {
                  return reqStatusId === selStatusId;
                }
                
                // Fallback: Name comparison
                const reqStatusName = String(req.status || "").trim().toLowerCase();
                const selStatusName = selectedStatusName;
                if (!selStatusName) return true; // If we can't resolve the name, don't filter out yet
                
                const selStatusNameAliases = 
                  selStatusName === "requested to warehouse"
                    ? ["requested to warehouse", "request to warehouse"]
                    : [selStatusName];
                
                return selStatusNameAliases.includes(reqStatusName);
              });

        setMrRequests(filteredRequests);
        setTotalRecords(
          statusFilter === "All"
            ? response.data.pagination?.totalRecords || response.data.records.length
            : filteredRequests.length
        );
      }
    } catch (error) {
      console.error("Error fetching material requests:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load material requests"
      });
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Default list status filter to "Requested to Warehouse" (dynamic from entity values).
  useEffect(() => {
    if (appliedStatusFilterDefault.current) return;

    if (!Array.isArray(mrStatuses) || mrStatuses.length === 0) {
      const timer = setTimeout(() => {
        if (!appliedStatusFilterDefault.current) {
          setStatusFilter("All");
          appliedStatusFilterDefault.current = true;
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    const requested = mrStatuses.find((s: { value_name?: string; name?: string }) => {
      const name = String(s?.value_name || s?.name || "").trim().toLowerCase();
      return name === "requested to warehouse";
    });
    const requestedId = requested != null ? String((requested as any).id ?? (requested as any).value_id ?? "").trim() : "";

    setStatusFilter(requestedId || "All");
    appliedStatusFilterDefault.current = true;
  }, [mrStatuses]);

  useEffect(() => {
    // Prevent fetching until statusFilter is initialized (either to a specific ID or "All")
    if (statusFilter === "") return;
    if (!areListFiltersReady) return;

    fetchRequests();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, operationFilter, shiftFilter, filterDate, areListFiltersReady]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleOperationChange = async (operationId: string, operationsSource?: any[]) => {
    const opId = Number(operationId);
    setFormData((prev: any) => ({ 
      ...prev, 
      operation_id: operationId, 
      production_plan_id: "", // Clear plan when operation changes
      items: [] 
    }));
    setQtyValidationErrors({});

    const ops = operationsSource ?? formOperations;
    const operation = ops.find((o: any) => Number(o.id) === opId);
    if (operation && (operation.inputs?.length || operation.outputs?.length)) {
      const sourceItems =
        operation.inputs?.length > 0 ? operation.inputs : operation.outputs || [];
      const items = sourceItems.map((out: any) => {
        const warehouseId = out.warehouse_id ?? defaultWarehouseIdStr;
        const warehouseName =
          out.warehouse_name ||
          resolveWarehouseName(warehouseId) ||
          "—";
        return {
          id: out.item_id,
          item_id: out.item_id,
          itemCode: out.item?.code || "",
          itemName: out.item?.name || "",
          uom: out.item?.uom || "",
          warehouse_id: warehouseId != null ? String(warehouseId) : "",
          warehouse_name: warehouseName,
          availableQty: out.availableQty || out.stock_qty || 0,
          requiredQty: 0,
        };
      });

      setFormData((prev: any) => ({ 
        ...prev, 
        operation_id: operationId, 
        production_plan_id: "",
        items 
      }));
      fetchProductionPlans(operationId, formData.shift_id);
    } else {
      fetchProductionPlans(operationId, formData.shift_id);
    }
  };

  const handleShiftChange = (shiftId: string) => {
    setFormData((prev: any) => ({ 
      ...prev, 
      shift_id: shiftId,
      production_plan_id: "" // Clear plan when shift changes
    }));
    fetchProductionPlans(formData.operation_id, shiftId);
  };

  const handleRequiredQtyChange = (itemId: number, newQty: string) => {
    let error = "";
    const numericQty = parseFloat(newQty) || 0;
    if (newQty !== "" && numericQty <= 0) {
      error = "Must be greater than 0";
    }
    setQtyValidationErrors(prev => ({ ...prev, [itemId]: error }));
    const updatedItems = formData.items?.map((item: any) =>
      item.id === itemId ? { ...item, requiredQty: newQty } : item
    ) || [];
    setFormData({ ...formData, items: updatedItems });
  };

  const hasShortage = (): boolean => {
    return formData.items?.some((item: any) => parseFloat(item.requiredQty.toString()) > item.availableQty) || false;
  };

  const handleSubmit = () => {
    if (!formData.requiredByDate) {
      toast({ variant: "destructive", title: "Validation Error", description: "Required By Date is required" });
      return;
    }
    if (!formData.shift_id) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }
    if (!formData.operation_id) {
      toast({ variant: "destructive", title: "Validation Error", description: "Operation is required" });
      return;
    }
    if (!formData.work_center_id) {
      toast({ variant: "destructive", title: "Validation Error", description: "Work Center is required" });
      return;
    }
    if (!formData.items || formData.items.length === 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "No items mapped for this operation" });
      return;
    }
    if (formData.items.some((item: any) => parseFloat(item.requiredQty.toString()) <= 0)) {
      toast({ variant: "destructive", title: "Validation Error", description: "Required Qty must be greater than 0 for all items" });
      return;
    }
    if (!formData.production_plan_id) {
      toast({ variant: "destructive", title: "Validation Error", description: "Production Plan is required" });
      return;
    }
    if (hasShortage()) {
      setShowShortageDialog(true);
    } else {
      submitMRRequest();
    }
  };

  const submitMRRequest = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const headerWarehouseId = Number(formData.items[0]?.warehouse_id);
      if (!Number.isFinite(headerWarehouseId) || headerWarehouseId <= 0) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Warehouse is missing on material lines from the server.",
        });
        setIsSaving(false);
        return;
      }
      const payload = {
        request_date: format(parseDateString(formData.date!), "yyyy-MM-dd"),
        required_by_date: format(parseDateString(formData.requiredByDate!), "yyyy-MM-dd"),
        operation_id: Number(formData.operation_id),
        work_center_id: Number(formData.work_center_id),
        warehouse_id: headerWarehouseId,
        shift_id: Number(formData.shift_id),
        production_plan_id: Number(formData.production_plan_id),
        items: formData.items.map((item: { mr_item_id?: number; item_id: number; id: number; requiredQty: number | string }) => ({
          ...(item.mr_item_id && { id: Number(item.mr_item_id) }),
          item_id: Number(item.item_id || item.id),
          required_qty: Number(item.requiredQty),
        }))
      };

      let response;
      if (editingId) {
        response = await productionApi.updateMyRequest(editingId, payload);
      } else {
        response = await productionApi.createMyRequest(payload);
      }

      if (response.isSuccessful) {
        toast({
          ...crudSuccessToast,
          title: "Success",
          description: response.message || (editingId ? "Material request updated successfully" : "Material request created successfully"),
          duration: 15000,
        });
        fetchRequests(); // Refresh the list
        handleCloseForm();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: response.message || "Failed to save material request",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Something went wrong",
      });
    } finally {
      setIsSaving(false);
    }
    setShowShortageDialog(false);
  };

  const handleShortageRedirect = () => {
    setShowShortageDialog(false);
    setLocation("/procurement/my-mr");
  };

  const handleView = async (id: number) => {
    if (openingMRId !== null || isSaving) return;

    setOpeningMRId(id);
    setIsViewLoading(true);
    setIsViewModalOpen(true);
    setViewingMR(null);
    try {
      const res = await productionApi.getMyRequestById(id);
      if (res.isSuccessful && res.data) {
        const mr = res.data;
        setViewingMR({
          id: id,
          mrNo: mr.mr_code,
          date: mr.request_date,
          requestedBy: mr.requested_by_name?.trim() || mr.requested_by || "System",
          requiredByDate: mr.required_by_date,
          shift: mr.shift_name,
          operation: mr.operation_name,
          workCenter: mr.work_center_name,
          warehouse: mr.warehouse_name,
          receivedDate: mr.received_date,
          status: mrRequests.find(r => r.id === id)?.status, // Keep status from list
          items: mr.items.map(item => ({
            id: item.id,
            item_id: item.item_id,
            itemCode: item.item_code,
            itemName: item.item_name,
            uom: item.uom,
            requiredQty: item.required_qty,
            issuedQty: item.issued_qty,
            receivedQty: item.received_qty
          }))
        });
      } else {
        setIsViewModalOpen(false);
      }
    } catch (error) {
      console.error("Error fetching MR details:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch request details" });
      setIsViewModalOpen(false);
    } finally {
      setIsViewLoading(false);
      setOpeningMRId(null);
    }
  };

  const handleMarkAsReceived = async () => {
    if (!viewingMR || viewingMR.status !== "Issued by Warehouse") return;

    const hasInvalidQty = viewingMR.items.some((item: { receivedQty?: number | string; issuedQty?: number }) => {
      const receivedQty = parseFloat(item.receivedQty?.toString() || "0");
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

    try {
      setIsSaving(true);
      const requestId = Number(viewingMR.id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        toast({ variant: "destructive", title: "Error", description: "Invalid request id" });
        return;
      }
      const response = await productionApi.receiveMaterials(requestId, {
        items: viewingMR.items.map((item: { id: number; receivedQty?: number | string; issuedQty?: number }) => ({
          id: Number(item.id),
          received_qty: Number(item.receivedQty ?? item.issuedQty ?? 0)
        }))
      });

      if (response.isSuccessful) {
        toast({
          ...crudSuccessToast,
          title: "Success",
          description: response.message || `MR ${viewingMR.mrNo} marked as received.`,
          duration: 15000,
        });
        fetchRequests(); // Refresh the list
        setIsViewModalOpen(false);
        setViewingMR(null);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: response.message || "Failed to mark as received",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Something went wrong",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // MR Request form logic unchanged; only UI container changed to Modal
  const handleOpenNewForm = async () => {
    if (openingMRId !== null || isSaving || isFormOpening) return;

    setIsFormOpening(true);
    try {
      const [opsList, wcList, whList] = await Promise.all([
        loadFormOperations(),
        loadFormWorkCenters(),
        loadFormWarehouses(),
      ]);

      const defaultWorkCenterId =
        assignedWorkcenterIds.length > 0 && wcList.length > 0
          ? getFirstAssignedMatch(
              assignedWorkcenterIds,
              prioritizeByAssigned<{ id: number; name: string }>(
                wcList,
                assignedWorkcenterIds,
                (wc) => wc.id
              ).map((wc) => wc.id)
            )
          : undefined;
      const defaultOperationId =
        assignedOperationIds.length > 0 && opsList.length > 0
          ? getFirstAssignedMatch(
              assignedOperationIds,
              prioritizeByAssigned<{ id: number; name: string }>(
                opsList,
                assignedOperationIds,
                (op) => op.id
              ).map((op) => op.id)
            )
          : undefined;
      setEditingId(null);
      setFormData({
        mrNo: "",
        date: getCurrentDateForInput(),
        requestedBy: "Current User",
        requiredByDate: getCurrentDateForInput(),
        operation_id: defaultOperationId ? String(defaultOperationId) : "",
        work_center_id: defaultWorkCenterId ? String(defaultWorkCenterId) : "",
        shift_id: "",
        production_plan_id: "",
        items: [],
      });
      setIsFormModalOpen(true);

      if (defaultOperationId) {
        await handleOperationChange(String(defaultOperationId), opsList);
      } else {
        fetchProductionPlans();
      }
    } catch (error) {
      console.error("Failed to open MR form:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to open the request form. Please try again.",
      });
    } finally {
      setIsFormOpening(false);
    }
  };

  const handleEdit = async (id: number) => {
    if (openingMRId !== null || isSaving) return;

    setOpeningMRId(id);
    setIsDetailLoading(true);
    setIsFormModalOpen(true);
    try {
      await Promise.all([
        loadFormOperations(),
        loadFormWorkCenters(),
        loadFormWarehouses(),
      ]);
      const res = await productionApi.getMyRequestById(id);
      if (res.isSuccessful && res.data) {
        const mr = res.data;
        setEditingId(id);
        setFormData({
          mrNo: mr.mr_code,
          date: mr.request_date,
          requestedBy: mr.requested_by_name?.trim() || mr.requested_by || "System",
          requiredByDate: mr.required_by_date,
          operation_id: String(mr.operation_id),
          work_center_id: String(mr.work_center_id),
          shift_id: String(mr.shift_id),
          production_plan_id: String(mr.production_plan_id),
          items: mr.items.map(item => ({
            mr_item_id: item.id, // Keep track of backend record ID
            item_id: item.item_id,
            id: item.item_id, // Map item_id to id for form logic
            itemCode: item.item_code,
            itemName: item.item_name,
            uom: item.uom,
            warehouse_id:
              item.warehouse_id != null
                ? String(item.warehouse_id)
                : String(mr.warehouse_id),
            warehouse_name: item.warehouse_name || mr.warehouse_name || "—",
            availableQty: item.available_qty || 0,
            requiredQty: item.required_qty
          }))
        });
        setQtyValidationErrors({});
        // Also fetch plans for this operation to populate the dropdown
        fetchProductionPlans(String(mr.operation_id));
      } else {
        setIsFormModalOpen(false);
      }
    } catch (error) {
      console.error("Error fetching MR details for edit:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch request details" });
      setIsFormModalOpen(false);
    } finally {
      setIsDetailLoading(false);
      setOpeningMRId(null);
    }
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setEditingId(null);
    setFormData({
      mrNo: "",
      date: getCurrentDateForInput(),
      requestedBy: "Current User",
      requiredByDate: getCurrentDateForInput(),
      operation_id: "",
      work_center_id: "",
      shift_id: "",
      production_plan_id: "",
      items: []
    });
  };

  const handleDelete = () => {
    if (editingId) {
      const updatedRequests = mrRequests.filter(mr => mr.id !== editingId);
      setMrRequests(updatedRequests);
      toast({
        ...crudSuccessToast,
        title: "Success",
        description: "MR Request deleted successfully",
        duration: 15000,
      });
      setIsDeleteOpen(false);
      handleCloseForm();
    }
  };

  // Apply assigned defaults when create modal opens and master data finishes loading
  useEffect(() => {
    if (!isFormModalOpen || editingId) return;

    setFormData((prev: typeof formData) => {
      let work_center_id = prev.work_center_id;
      let operation_id = prev.operation_id;

      if (!work_center_id && assignedWorkcenterIds.length && orderedWorkCenters.length) {
        const firstWorkCenter = getFirstAssignedMatch(
          assignedWorkcenterIds,
          orderedWorkCenters.map((wc) => wc.id)
        );
        if (firstWorkCenter) work_center_id = String(firstWorkCenter);
      }

      if (!operation_id && assignedOperationIds.length && orderedFormOperations.length) {
        const firstOperation = getFirstAssignedMatch(
          assignedOperationIds,
          orderedFormOperations.map((op) => op.id)
        );
        if (firstOperation) operation_id = String(firstOperation);
      }

      if (
        work_center_id === prev.work_center_id &&
        operation_id === prev.operation_id
      ) {
        return prev;
      }

      return { ...prev, work_center_id, operation_id };
    });
  }, [
    isFormModalOpen,
    editingId,
    assignedWorkcenterIds,
    assignedOperationIds,
    orderedWorkCenters,
    orderedFormOperations,
  ]);

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  const totalPages = Math.ceil(totalRecords / itemsPerPage);
  const paginatedData = mrRequests;

  const canSaveRequest =
    !isSaving &&
    !isDetailLoading &&
    Boolean(formData.date) &&
    Boolean(formData.requiredByDate) &&
    Boolean(formData.shift_id) &&
    Boolean(formData.operation_id) &&
    Boolean(formData.work_center_id) &&
    Boolean(formData.production_plan_id) &&
    (formData.items?.length ?? 0) > 0 &&
    formData.items!.every((item: { requiredQty: number | string }) => {
      const q = parseFloat(String(item.requiredQty));
      return !Number.isNaN(q) && q > 0;
    });

  const isRowActionBusy = openingMRId !== null || isSaving;

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

      <AppListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search by MR Code or Operation..."
        }}
        filters={[
          {
            type: 'select',
            label: 'Operation',
            value: operationFilter,
            options: [
              { label: "All Operations", value: "All" },
              ...orderedListOperations.map(op => ({ label: op.name, value: String(op.id) }))
            ],
            onChange: setOperationFilter,
            searchable: true
          },
          {
            type: 'select',
            label: 'Shift',
            value: shiftFilter,
            options: [
              { label: "All Shifts", value: "All" },
              ...shifts.map(s => ({ 
                label: s.name, 
                value: String(s.id) 
              }))
            ],
            onChange: setShiftFilter,
            searchable: true
          },
          {
            type: 'select',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: "All Status", value: "All" },
              ...mrStatuses.map(s => ({ 
                label: s.value_name || s.name, 
                value: String(s.id) 
              }))
            ],
            onChange: setStatusFilter,
            searchable: true
          },
          {
            type: 'date',
            label: 'Date',
            value: filterDate ? parseDateString(filterDate.split('-').reverse().join('-')) : undefined,
            onChange: (date) => setFilterDate(date ? format(date, "dd-MM-yyyy") : ""),
            showClear: !!filterDate
          }
        ]}
        actions={[
          ...(canCreate(permissionModule) ? [{
            label: "My Request",
            icon: <Plus className="h-4 w-4" />,
            onClick: handleOpenNewForm,
          }] : [])
        ]}
      />

      {/* Table Card - UI matches Materials reference */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">MR Code</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!areListFiltersReady || isListLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
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
                      <TableCell className="text-center py-4">
                        <div className={cn(isRowActionBusy && "pointer-events-none opacity-50")}>
                          <TableActionButtons
                            onView={canView(permissionModule) ? () => handleView(request.id) : undefined}
                            onEdit={(request.status === "Requested to Warehouse" && canEdit(permissionModule)) ? () => handleEdit(request.id) : undefined}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination - Same position as Materials reference */}
          {areListFiltersReady && totalRecords > 0 && !isListLoading && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalRecords}
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
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Material Request: {viewingMR?.mrNo ?? "..."}</DialogTitle>
          </DialogHeader>

          {isViewLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : viewingMR && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>MR Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>MR Code</Label>
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
                          {viewingMR.items.map((item: any) => (
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
                                        type="text"
                                        inputMode="decimal"
                                        value={item.receivedQty ?? item.issuedQty ?? 0}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                            const updatedItems = viewingMR.items.map((i: any) =>
                                              i.id === item.id ? { ...i, receivedQty: val } : i
                                            );
                                            setViewingMR({ ...viewingMR, items: updatedItems });
                                          }
                                        }}
                                        className="w-24 text-right"
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
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)} disabled={isSaving}>
              Close
            </Button>
            {viewingMR && viewingMR.status === "Issued by Warehouse" && (
              <Button onClick={handleMarkAsReceived} variant="default" loading={isSaving} disabled={isSaving || isViewLoading}>
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
            <AlertDialogAction onClick={handleShortageRedirect}>
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
        <DialogContent
          ref={setFormDialogEl}
          className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
            <DialogTitle className="text-lg font-bold sm:text-xl">
              {editingId ? "Edit MR Request" : "New MR Request"}
            </DialogTitle>
            <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
              Configure MR details and material requirements for production.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
            {isDetailLoading || isFormOpening ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 sm:min-h-[320px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
            <div className="space-y-5">
              <div>
                <h3 className="border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                  MR Information
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                  {editingId && (
                    <div className="min-w-0 space-y-1.5 md:col-span-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">MR Code</Label>
                      <Input value={formData.mrNo} readOnly className="pointer-events-none h-9 bg-muted font-mono text-sm" />
                    </div>
                  )}
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Request Date <span className="text-red-500">*</span>
                    </Label>
                    <SharedDatePicker
                      date={formData.date ? parseDateString(formData.date) : undefined}
                      setDate={(date) => setFormData((prev: any) => ({ ...prev, date: date ? format(date, "yyyy-MM-dd") : "" }))}
                      showClear={false}
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Required By Date <span className="text-red-500">*</span>
                    </Label>
                    <SharedDatePicker
                      date={formData.requiredByDate ? parseDateString(formData.requiredByDate) : undefined}
                      setDate={(date) => setFormData((prev: any) => ({ ...prev, requiredByDate: date ? format(date, "yyyy-MM-dd") : "" }))}
                      showClear={false}
                    />
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <SharedSearchableSelect
                      label="Operation *"
                      value={formData.operation_id}
                      options={operationSelectOptions}
                      onChange={handleOperationChange}
                      showSelectedTitle
                      compactStackedSelected
                      popoverCollisionBoundary={formDialogEl}
                      popoverCollisionPadding={8}
                      listClassName="max-h-[200px]"
                    />
                  </div>
                  <div className="min-w-0">
                    <SharedSearchableSelect
                      label="Shift *"
                      value={formData.shift_id}
                      onChange={handleShiftChange}
                      options={shifts.map((s) => ({
                        label: s.name,
                        value: String(s.id),
                      }))}
                      className="h-9"
                      popoverCollisionBoundary={formDialogEl}
                      popoverCollisionPadding={8}
                    />
                  </div>
                  <div className="min-w-0">
                    <SharedSearchableSelect
                      label="Work Center *"
                      value={formData.work_center_id}
                      options={orderedWorkCenters.map(wc => ({ value: String(wc.id), label: wc.name }))}
                      onChange={(val) => setFormData({ ...formData, work_center_id: val })}
                      className="h-9"
                      popoverCollisionBoundary={formDialogEl}
                      popoverCollisionPadding={8}
                    />
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <SharedSearchableSelect
                      label="Production Plan *"
                      placeholder="Select Production Plan"
                      value={formData.production_plan_id?.toString() || ""}
                      options={activePlans.map(p => ({
                        value: p.id.toString(),
                        label: p.code,
                      }))}
                      onChange={(val) => setFormData({ ...formData, production_plan_id: val })}
                      selectedTruncate="end"
                      showSelectedTitle
                      lightSelectedText
                      className="h-9"
                      popoverCollisionBoundary={formDialogEl}
                      popoverCollisionPadding={8}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                  Material Requirements
                </h3>
                <div
                  className={cn(
                    "mt-3 overflow-hidden rounded-md border bg-white",
                    (formData.items?.length ?? 0) > 4 && "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                  )}
                >
                  <div className="overflow-x-auto">
                    <Table className="w-full min-w-[860px] table-fixed">
                      <colgroup>
                        <col className="w-[14%]" />
                        <col className="w-[26%]" />
                        <col className="w-[10%]" />
                        <col className="w-[18%]" />
                        <col className="w-[10%]" />
                        <col className="w-[22%]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="py-3 pl-4 text-[10px] font-bold uppercase tracking-wider">
                            Item Code
                          </TableHead>
                          <TableHead className="py-3 text-[10px] font-bold uppercase tracking-wider">
                            Item Name
                          </TableHead>
                          <TableHead className="py-3 text-center text-[10px] font-bold uppercase tracking-wider">
                            UOM
                          </TableHead>
                          <TableHead className="py-3 text-[10px] font-bold uppercase tracking-wider">
                            Warehouse
                          </TableHead>
                          <TableHead className="py-3 text-right text-[10px] font-bold uppercase tracking-wider">
                            Stock
                          </TableHead>
                          <TableHead className="py-3 pr-4 text-right text-[10px] font-bold uppercase tracking-wider">
                            Required Qty
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.items?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                              Select an operation to load materials
                            </TableCell>
                          </TableRow>
                        ) : (
                          formData.items?.map((item: any) => (
                            <TableRow key={item.id} className="hover:bg-muted/5">
                              <TableCell className="max-w-0 overflow-hidden align-top py-3 pl-4">
                                <p className="m-0 font-mono text-[10px] leading-snug break-all text-muted-foreground">
                                  {item.itemCode}
                                </p>
                              </TableCell>
                              <TableCell className="max-w-0 overflow-hidden align-top py-3">
                                <p className="m-0 text-sm font-medium leading-snug wrap-break-word text-slate-900">
                                  {item.itemName}
                                </p>
                              </TableCell>
                              <TableCell className="align-top py-3 text-center text-xs whitespace-nowrap">
                                {item.uom}
                              </TableCell>
                              <TableCell className="align-top py-3 text-sm text-foreground whitespace-nowrap">
                                {item.warehouse_name || "—"}
                              </TableCell>
                              <TableCell className="align-top py-3 text-right text-sm font-medium whitespace-nowrap">
                                {item.availableQty}
                              </TableCell>
                              <TableCell className="align-top py-3 pr-4">
                                <div className="flex flex-col items-end gap-1">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    className={cn(
                                      "ml-auto h-8 w-full min-w-20 max-w-32 text-right font-mono",
                                      qtyValidationErrors[item.id as any] && "border-destructive focus-visible:ring-destructive"
                                    )}
                                    value={item.requiredQty}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 12)) {
                                        handleRequiredQtyChange(item.id as any, val);
                                      }
                                    }}
                                  />
                                  {qtyValidationErrors[item.id as any] && (
                                    <p className="text-[10px] text-destructive">{qtyValidationErrors[item.id as any]}</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 pb-4 pt-3 sm:justify-end sm:px-5">
            <Button
              variant="outline"
              onClick={handleCloseForm}
              disabled={isSaving || isDetailLoading || isFormOpening}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={isSaving}
              disabled={!canSaveRequest}
              className={cn(
                "w-full sm:w-auto",
                canSaveRequest
                  ? "bg-blue-600 text-white hover:bg-blue-600/90 border-blue-600"
                  : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
              )}
            >
              {editingId ? "Update Request" : "Save Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
