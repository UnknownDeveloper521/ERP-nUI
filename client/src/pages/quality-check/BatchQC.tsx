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

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAssignedIds,
  getFirstAssignedMatch,
  prioritizeByAssigned,
} from "@/utils/assignedDropdown";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { useToast } from "@/hooks/use-toast";
import { productionApi, commonApi, type BatchQCListResponse } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import {
  type BatchItem as QCItem,
  type QCParameter,
  type BatchRecord,
} from "@/lib/batchSharedData";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Batch QC interface - Batch-centric QC verification
 */
type BatchQC = BatchRecord;

type QcListRow = BatchQCListResponse["data"]["records"][number];

/** PRODUCTION_BATCH_STATUS: only these appear in Batch QC (match entity_values.value_code). */
const BATCH_QC_VALUE_CODE_ORDER = ["SEND_FOR_QC", "VERIFIED_QC"] as const;

type BatchQCValueCode = (typeof BATCH_QC_VALUE_CODE_ORDER)[number];

type BatchQCTableRow = BatchRecord & {
  __valueCode?: string;
  __statusName?: string;
};

function normalizeBatchStatusValueCode(entity: { value_code?: string; code?: string } | null | undefined): string {
  return String(entity?.value_code ?? "").trim().toUpperCase();
}

/** From PRODUCTION_BATCH_STATUS, keep only the two QC value_codes. */
function filterQcStatusEntitiesByValueCode(
  entityValues: any[]
): Array<Record<string, any> & { value_code: string }> {
  const allow = new Set<BatchQCValueCode>(BATCH_QC_VALUE_CODE_ORDER);
  return (entityValues || [])
    .filter((e) => allow.has(normalizeBatchStatusValueCode(e) as BatchQCValueCode))
    .sort(
      (a, b) =>
        BATCH_QC_VALUE_CODE_ORDER.indexOf(normalizeBatchStatusValueCode(a) as BatchQCValueCode) -
        BATCH_QC_VALUE_CODE_ORDER.indexOf(normalizeBatchStatusValueCode(b) as BatchQCValueCode)
    ) as Array<Record<string, any> & { value_code: string }>;
}

/**
 * Map API list row's status_id to the entity's value_code (PRODUCTION_BATCH_STATUS), for UI logic.
 * Only compares on master rows — join key is the FK from the list row, not a hardcoded id.
 */
function valueCodeForBatchListStatusId(
  statusId: number | string | null | undefined,
  productionBatchStatusEntities: any[]
): string | undefined {
  if (statusId == null || !Number.isFinite(Number(statusId))) return undefined;
  const sid = Number(statusId);
  const row = (productionBatchStatusEntities || []).find(
    (e) =>
      Number(e?.id) === sid ||
      Number((e as any).status_id) === sid ||
      Number((e as any).value_id) === sid ||
      Number((e as any).entity_id) === sid
  );
  if (!row) return undefined;
  return normalizeBatchStatusValueCode(row);
}

function mapQcListRowToRecord(r: QcListRow, productionBatchStatusEntities: any[]): BatchQCTableRow {
  const code = valueCodeForBatchListStatusId(r.status_id, productionBatchStatusEntities);
  const isSend = code === "SEND_FOR_QC";
  const isVerified = code === "VERIFIED_QC";
  return {
    id: r.batch_id,
    batchNo: r.batch_code,
    date: r.batch_date,
    mrNo: r.mr_code ?? "",
    operation: r.operation_name,
    workCenter: r.work_center_name,
    warehouse: "",
    shift: r.shift_name as any,
    status: (isVerified
      ? "Verified QC"
      : isSend
        ? "Sent for QC"
        : "Batch Created") as BatchRecord["status"],
    qcStatus: isVerified ? "Verified" : isSend ? "Sent for QC" : undefined,
    qcRequired: true,
    __valueCode: code,
    __statusName: r.status_name
  };
}

function isSendForQcValueCode(v: string | undefined) {
  return v === "SEND_FOR_QC";
}

function isVerifiedQcValueCode(v: string | undefined) {
  return v === "VERIFIED_QC";
}

function mapBatchQcDetailItemsToOutputItems(items: any[] | undefined): QCItem[] {
  if (!items?.length) return [];
  return items.map((item) => ({
    id: item.item_id,
    item_id: item.item_id,
    item: item.item_name,
    itemName: item.item_name,
    itemCode: item.item_code,
    uom: item.uom_name,
    qtyProduced: item.produced_qty ?? 0,
    qtySupplied: 0,
    verifiedQty: item.verified_qty
  }));
}

function mapBatchQcApiParametersToQcParams(raw: any[] | undefined): QCParameter[] {
  if (!raw?.length) return [];
  return raw.map((p, i) => ({
    id: p.id ?? p.parameter_id ?? i + 1,
    parameterName: p.parameter_name ?? p.parameterName ?? p.name ?? "Parameter",
    description: p.description ?? p.parameter_description ?? ""
  }));
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
  const { isMenuVisible, canEdit, canView } = useHasPermission();
  const permissionModule = "QUALITY_CHECK/BATCH_QC";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();
  const batchStatuses = useCommonStore((s) => s.batchStatuses);

  const productionBatchQcStatusEntities = React.useMemo(
    () => filterQcStatusEntitiesByValueCode(batchStatuses),
    [batchStatuses]
  );

  const firstAvailableQcValueCode = React.useMemo((): string => {
    for (const code of BATCH_QC_VALUE_CODE_ORDER) {
      if (productionBatchQcStatusEntities.some((e) => normalizeBatchStatusValueCode(e) === code)) {
        return code;
      }
    }
    return BATCH_QC_VALUE_CODE_ORDER[0];
  }, [productionBatchQcStatusEntities]);

  // ============================================================================
  // STATE
  // ============================================================================
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(BATCH_QC_VALUE_CODE_ORDER[0]);
  const [operationFilter, setOperationFilter] = useState("All");
  const [workCenterFilter, setWorkCenterFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [batches, setBatches] = useState<BatchQCTableRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [openingBatchId, setOpeningBatchId] = useState<number | null>(null);
  const appliedOperationFilterDefault = useRef(false);
  const appliedWorkCenterFilterDefault = useRef(false);
  const [areListFiltersReady, setAreListFiltersReady] = useState(() => {
    const op = getAssignedIds("operation");
    const wc = getAssignedIds("workcenter");
    return op.length === 0 && wc.length === 0;
  });
  const [operations, setOperations] = useState<any[]>([]);
  const [workCenters, setWorkCenters] = useState<any[]>([]);

  const assignedOperationIds = getAssignedIds("operation");
  const assignedWorkcenterIds = getAssignedIds("workcenter");
  const assignedOperationKey = assignedOperationIds.join(",");
  const assignedWorkcenterKey = assignedWorkcenterIds.join(",");

  const orderedOperations = useMemo(
    () => prioritizeByAssigned(operations, assignedOperationIds, (o) => o.id || o.operation_id),
    [operations, assignedOperationKey]
  );

  const orderedWorkCenters = useMemo(
    () => prioritizeByAssigned(workCenters, assignedWorkcenterIds, (w) => w.id || w.work_center_id),
    [workCenters, assignedWorkcenterKey]
  );
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBatch, setViewingBatch] = useState<BatchQCTableRow | null>(null);
  const [editableItems, setEditableItems] = useState<QCItem[]>([]);
  const [editableQCParameters, setEditableQCParameters] = useState<QCParameter[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<string>("");
  const [isVerifySubmitting, setIsVerifySubmitting] = useState(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const load = async () => {
      try {
        const [opRes, wcRes] = await Promise.all([
          commonApi.getOperations(),
          commonApi.getWorkCenters()
        ]);
        let operationRecords: any[] = [];
        if (opRes.isSuccessful && opRes.data?.records) {
          operationRecords = opRes.data.records;
          setOperations(operationRecords);
        }
        if (
          !appliedOperationFilterDefault.current &&
          assignedOperationIds.length > 0 &&
          operationRecords.length > 0
        ) {
          const ordered = prioritizeByAssigned(
            operationRecords,
            assignedOperationIds,
            (o) => o.id || o.operation_id
          );
          const firstAssigned = getFirstAssignedMatch(
            assignedOperationIds,
            ordered.map((o) => o.id || o.operation_id)
          );
          if (firstAssigned) {
            const op = operationRecords.find(
              (o) => String(o.id || o.operation_id) === firstAssigned
            );
            if (op) {
              setOperationFilter(op.operation_name || op.name);
              appliedOperationFilterDefault.current = true;
            }
          }
        }

        let workCenterRecords: any[] = [];
        if (wcRes.isSuccessful && wcRes.data?.records) {
          workCenterRecords = wcRes.data.records;
          setWorkCenters(workCenterRecords);
        }
        if (
          !appliedWorkCenterFilterDefault.current &&
          assignedWorkcenterIds.length > 0 &&
          workCenterRecords.length > 0
        ) {
          const ordered = prioritizeByAssigned(
            workCenterRecords,
            assignedWorkcenterIds,
            (w) => w.id || w.work_center_id
          );
          const firstAssigned = getFirstAssignedMatch(
            assignedWorkcenterIds,
            ordered.map((w) => w.id || w.work_center_id)
          );
          if (firstAssigned) {
            const wc = workCenterRecords.find(
              (w) => String(w.id || w.work_center_id) === firstAssigned
            );
            if (wc) {
              setWorkCenterFilter(wc.work_center_name || wc.name);
              appliedWorkCenterFilterDefault.current = true;
            }
          }
        }
      } catch (e) {
        console.error("Failed to load Batch QC filter options", e);
      } finally {
        setAreListFiltersReady(true);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const available = new Set(
      productionBatchQcStatusEntities.map((e) => normalizeBatchStatusValueCode(e))
    );
    if (available.size === 0) return;
    if (!available.has(String(statusFilter).toUpperCase())) {
      setStatusFilter(firstAvailableQcValueCode);
    }
  }, [productionBatchQcStatusEntities, firstAvailableQcValueCode, statusFilter]);

  const refetchBatches = useCallback(async () => {
    if (!areListFiltersReady) return;
    setIsListLoading(true);
    try {
      const op =
        operationFilter === "All"
          ? undefined
          : operations.find(
              (o) => (o.operation_name || o.name) === operationFilter
            );
      const wc =
        workCenterFilter === "All"
          ? undefined
          : workCenters.find(
              (w) => (w.work_center_name || w.name) === workCenterFilter
            );
      const filterCode = String(statusFilter).trim().toUpperCase() as BatchQCValueCode;
      const statusEntity = productionBatchQcStatusEntities.find(
        (e) => normalizeBatchStatusValueCode(e) === filterCode
      );
      const status_id =
        statusEntity != null && statusEntity.id != null
          ? Number(statusEntity.id)
          : statusEntity != null && (statusEntity as any).status_id != null
            ? Number((statusEntity as any).status_id)
            : undefined;

      const res = await productionApi.getBatchQCList({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm?.trim() || undefined,
        operation_id: op?.id,
        work_center_id: wc?.id ?? wc?.work_center_id,
        status_id
      });
      if (res.isSuccessful && res.data) {
        setBatches(
          res.data.records.map((row) => mapQcListRowToRecord(row, batchStatuses))
        );
        setTotalRecords(res.data.pagination.totalRecords);
      } else {
        setBatches([]);
        setTotalRecords(0);
        toast({
          variant: "destructive",
          title: "ERROR",
          description: res.message || "Failed to load batch QC list",
          duration: 15000
        });
      }
    } catch {
      setBatches([]);
      setTotalRecords(0);
      toast({ variant: "destructive", title: "ERROR", description: "Failed to load batch QC list", duration: 15000 });
    } finally {
      setIsListLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    searchTerm,
    operationFilter,
    workCenterFilter,
    statusFilter,
    operations,
    workCenters,
    batchStatuses,
    productionBatchQcStatusEntities,
    areListFiltersReady,
    toast
  ]);

  const isActionBusy =
    isListLoading || openingBatchId !== null || isVerifySubmitting || isDetailLoading;

  useEffect(() => {
    void refetchBatches();
  }, [refetchBatches]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const openBatchModalFromApiDetail = (batch: BatchQCTableRow, outputItems: QCItem[], mode: "view" | "edit") => {
    const operationParams = OPERATION_QC_PARAMETERS[batch.operation] || [];
    const lineItems = outputItems.length > 0 ? outputItems : batch.outputItems || [];
    const hasLineItems = lineItems.length > 0;
    const hasApiQcParams = (batch.qcParameters?.length ?? 0) > 0;
    if (!hasLineItems && !hasApiQcParams && operationParams.length === 0) {
      toast({
        title: "QC Not Required",
        description: `Operation "${batch.operation}" has no QC line items or parameters.`,
        variant: "destructive",
        duration: 15000
      });
      return;
    }
    setEditableItems(
      lineItems.map((item: any) => ({
        ...item,
        verifiedQty:
          mode === "edit" ? item.verifiedQty ?? (item.qtyProduced || 0) : item.verifiedQty
      }))
    );
    const qcParams =
      batch.qcParameters && batch.qcParameters.length > 0
        ? batch.qcParameters
        : operationParams;
    setEditableQCParameters(qcParams);
    setValidationErrors({});
    setRemarks(batch.remarks || "");
    setViewingBatch({ ...batch, outputItems: outputItems.length > 0 ? outputItems : batch.outputItems });
    setIsReadOnly(mode === "view");
    setIsViewModalOpen(true);
  };

  const handleViewBatch = async (batch: BatchQCTableRow, mode: "view" | "edit" = "view") => {
    if (isListLoading || openingBatchId !== null || isVerifySubmitting) return;
    setOpeningBatchId(batch.id);
    setIsDetailLoading(true);
    setIsViewModalOpen(true);
    setViewingBatch(null);
    try {
      const res = await productionApi.getBatchQCById(batch.id);
      if (!res.isSuccessful || !res.data) {
        openBatchModalFromApiDetail(batch, (batch.outputItems as QCItem[]) || [], mode);
        return;
      }
      const d = res.data;
      const batchData = d?.batch_id != null || d?.batch_code != null ? d : (d as any)?.data ?? d;
      const outputItems = mapBatchQcDetailItemsToOutputItems(batchData.items ?? []);
      const detailStatusId = batchData.status_id;
      const vCode = valueCodeForBatchListStatusId(detailStatusId, batchStatuses) ?? batch.__valueCode;
      const fromApiParams = mapBatchQcApiParametersToQcParams(batchData.qc_parameters ?? []);
      const merge: BatchQCTableRow = {
        ...batch,
        batchNo: batchData.batch_code ?? batch.batchNo,
        date: batchData.batch_date ?? batch.date,
        operation: batchData.operation_name ?? batch.operation,
        workCenter: batchData.work_center_name ?? batch.workCenter,
        shift: (batchData.shift_name as any) ?? batch.shift,
        __valueCode: vCode,
        __statusName: batchData.status_name ?? batch.__statusName,
        inputItems: [],
        outputItems,
        qcParameters: fromApiParams.length > 0 ? fromApiParams : undefined,
        remarks: batchData.remarks ?? undefined,
        qcVerifiedBy: isVerifiedQcValueCode(vCode)
          ? (batchData.verified_by_name || batchData.verified_by || "Auto Verified")
          : (batchData.verified_by_name ?? undefined),
        qcVerifiedOn: batchData.verified_on ?? undefined
      };
      openBatchModalFromApiDetail(merge, outputItems, mode);
    } catch {
      openBatchModalFromApiDetail(batch, (batch.outputItems as QCItem[]) || [], mode);
    } finally {
      setIsDetailLoading(false);
      setOpeningBatchId(null);
    }
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

  const handleVerifyQC = async () => {
    if (!viewingBatch) return;

    const hasErrors = editableItems.some((item) => {
      const verifiedQty = parseFloat((item.verifiedQty ?? 0).toString());
      const qtyProduced = parseFloat((item.qtyProduced || 0).toString());
      return isNaN(verifiedQty) || verifiedQty < 0 || verifiedQty > qtyProduced;
    });

    if (hasErrors || Object.keys(validationErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix all validation errors before verifying.",
        variant: "destructive",
        duration: 15000
      });
      return;
    }

    const batchId = viewingBatch.id;
    if (batchId == null || !Number.isFinite(Number(batchId))) {
      toast({ variant: "destructive", title: "ERROR", description: "Invalid batch id.", duration: 15000 });
      return;
    }

    setIsVerifySubmitting(true);
    try {
      const res = await productionApi.verifyBatchQC(Number(batchId), {
        items: editableItems.map((item) => {
          const itemId = Number(item.item_id ?? item.id);
          const verifiedQty = parseFloat(String(item.verifiedQty ?? 0));
          return { item_id: itemId, verified_qty: verifiedQty };
        }),
        remarks: remarks.trim() ? remarks.trim() : null
      });
      if (res.isSuccessful) {
        const code = viewingBatch.batchNo;
        setIsViewModalOpen(false);
        setViewingBatch(null);
        setEditableItems([]);
        setEditableQCParameters([]);
        setRemarks("");
        setValidationErrors({});
        void refetchBatches();
        toast({
          variant: "success",
          title: "Success",
          description: res.message || `Batch ${code} verified successfully.`,
          duration: 15000
        });
      } else {
        toast({
          variant: "destructive",
          title: "ERROR",
          description: res.message || "Batch QC verification failed.",
          duration: 15000
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Batch QC verification failed.";
      toast({ variant: "destructive", title: "ERROR", description: msg, duration: 15000 });
    } finally {
      setIsVerifySubmitting(false);
    }
  };

  // ============================================================================
  // PAGINATION (server-side list)
  // ============================================================================

  const totalPages = Math.max(1, Math.ceil((totalRecords || 0) / (itemsPerPage || 1)));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalRecords, currentPage, totalPages]);

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
          onChange: (v) => {
            setCurrentPage(1);
            setSearchTerm(v);
          },
          placeholder: "Search by Batch No / Operation / Work Center..."
        }}
        filters={[
          {
            type: "select",
            label: "Operation",
            value: operationFilter,
            options: [
              { label: "All Operations", value: "All" },
              ...orderedOperations.map((o) => ({
                label: o.operation_name || o.name || `Operation ${o.id}`,
                value: o.operation_name || o.name
              }))
            ],
            onChange: (v) => {
              setCurrentPage(1);
              setOperationFilter(v);
            },
            searchable: true
          },
          {
            type: "select",
            label: "Work Center",
            value: workCenterFilter,
            options: [
              { label: "All Work Centers", value: "All" },
              ...orderedWorkCenters.map((w) => ({
                label: w.work_center_name || w.name || `Work center ${w.id ?? ""}`,
                value: w.work_center_name || w.name
              }))
            ],
            onChange: (v) => {
              setCurrentPage(1);
              setWorkCenterFilter(v);
            },
            searchable: true
          },
          {
            type: "select",
            label: "Status",
            value: statusFilter,
            options: productionBatchQcStatusEntities.map((e) => ({
              label: (e as any).value_name || (e as any).name || (e as any).value_code,
              value: normalizeBatchStatusValueCode(e)
            })),
            onChange: (value) => {
              setCurrentPage(1);
              setStatusFilter(String(value).toUpperCase());
            },
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
                {isListLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No batches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium font-mono">{batch.batchNo}</TableCell>
                      <TableCell>{formatDate(batch.date)}</TableCell>
                      <TableCell>{batch.operation}</TableCell>
                      <TableCell>{batch.workCenter}</TableCell>
                      <TableCell>{batch.shift}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            isSendForQcValueCode(batch.__valueCode) ? "default" : "secondary"
                          }
                        >
                          {batch.__statusName || batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={cn(isActionBusy && "pointer-events-none opacity-50")}>
                          <TableActionButtons
                            onView={canView(permissionModule) ? () => handleViewBatch(batch, "view") : undefined}
                            onEdit={
                              (isSendForQcValueCode(batch.__valueCode) && canEdit(permissionModule))
                                ? () => handleViewBatch(batch, "edit")
                                : undefined
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalRecords > 0 && !isListLoading && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalRecords}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(n) => {
              setCurrentPage(1);
              setItemsPerPage(n);
            }}
            options={[10, 15, 30, 50]}
          />
          )}
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
          setIsVerifySubmitting(false);
        } else {
          setIsViewModalOpen(true);
        }
      }}
      >
        <DialogContent
          className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
            <DialogTitle className="text-lg font-bold sm:text-xl">
              {isReadOnly ? "QC Verification Details" : "Verify Quality Check"}
            </DialogTitle>
            <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
              {isReadOnly
                ? "View verified quality check details"
                : "Review and verify the produced quantities for this batch"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
            {isDetailLoading ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 sm:min-h-[320px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : viewingBatch ? (
              <div className="space-y-5">
                {/* Header Info - Read Only */}
                <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5 lg:grid-cols-3">
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batch No</Label>
                    <p className="truncate font-mono text-sm font-semibold" title={viewingBatch.batchNo}>
                      {viewingBatch.batchNo}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batch Date</Label>
                    <p className="text-sm font-semibold">{formatDate(viewingBatch.date)}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shift</Label>
                    <p className="text-sm font-semibold">{viewingBatch.shift}</p>
                  </div>
                  <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operation</Label>
                    <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={viewingBatch.operation}>
                      {viewingBatch.operation}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Work Center</Label>
                    <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={viewingBatch.workCenter}>
                      {viewingBatch.workCenter}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">QC Status</Label>
                    <div className="pt-0.5">
                      <Badge
                        variant={isSendForQcValueCode(viewingBatch.__valueCode) ? "default" : "secondary"}
                        className="whitespace-nowrap"
                      >
                        {viewingBatch.__statusName || viewingBatch.status}
                      </Badge>
                    </div>
                  </div>
                  {(isVerifiedQcValueCode(viewingBatch.__valueCode) ||
                    (isReadOnly && viewingBatch.qcVerifiedBy)) && (
                    <>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verified By</Label>
                        <p className="truncate text-sm font-semibold" title={String(viewingBatch.qcVerifiedBy || "")}>
                          {viewingBatch.qcVerifiedBy}
                        </p>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verified On</Label>
                        <p className="text-sm font-semibold">
                          {formatDate(viewingBatch.qcVerifiedOn || new Date().toISOString())}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* QC Parameters Section */}
                {editableQCParameters.length > 0 && (
                  <div className="space-y-3">
                    <Label className="block border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                      QC Parameters
                    </Label>
                    <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                      <div className="overflow-x-auto">
                        <Table className="w-full min-w-[640px] table-fixed">
                          <colgroup>
                            <col className="w-[34%]" />
                            <col className="w-[66%]" />
                          </colgroup>
                          <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">Parameter</TableHead>
                              <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editableQCParameters.map((param) => (
                              <TableRow key={param.id} className="border-b last:border-0">
                                <TableCell className="align-top">
                                  <span className="text-xs font-semibold">{param.parameterName}</span>
                                </TableCell>
                                <TableCell className="align-top">
                                  <span className="whitespace-normal wrap-break-word text-xs text-muted-foreground">
                                    {param.description}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="space-y-3">
                  <Label className="block border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                    Items for Verification
                  </Label>
                  <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <Table className="w-full min-w-[760px] table-fixed">
                        <colgroup>
                          <col className="w-[22%]" />
                          <col className="w-[44%]" />
                          <col className="w-[10%]" />
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">Item Code</TableHead>
                            <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">Item Name</TableHead>
                            <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">UOM</TableHead>
                            <TableHead className="py-2 text-right text-[10px] font-bold uppercase tracking-wider">Produced Qty</TableHead>
                            <TableHead className="py-2 text-right text-[10px] font-bold uppercase tracking-wider">Verified Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editableItems.map((item) => (
                            <TableRow key={item.id} className="border-b last:border-0">
                              <TableCell className="align-top">
                                <span className="block font-mono text-[11px] font-semibold" title={item.itemCode}>
                                  {item.itemCode}
                                </span>
                              </TableCell>
                              <TableCell className="align-top">
                                <span className="block whitespace-normal wrap-break-word text-xs font-medium" title={item.itemName}>
                                  {item.itemName}
                                </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-top text-xs">
                                {item.uom}
                              </TableCell>
                              <TableCell className="whitespace-nowrap align-top text-right text-xs tabular-nums">
                                {item.qtyProduced || 0}
                              </TableCell>
                              <TableCell className="align-top text-right font-mono">
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
                                      className={cn(
                                        "h-9 w-24 px-2 text-right text-xs font-bold tabular-nums",
                                        validationErrors[item.id as any]
                                          ? "border-destructive focus-visible:ring-destructive/20"
                                          : "focus-visible:ring-primary/20"
                                      )}
                                    />
                                    {validationErrors[item.id as any] && (
                                      <span className="text-[10px] font-bold text-destructive">
                                        {validationErrors[item.id as any]}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold tabular-nums">
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
                </div>

                {/* Remarks Field */}
                <div className="space-y-3">
                  <Label className="block border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                    Remarks
                  </Label>
                  {!isReadOnly ? (
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter any remarks or observations..."
                      className="min-h-[96px] resize-none focus-visible:ring-primary/20"
                    />
                  ) : (
                    <div className="min-h-[96px] rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                      {remarks || <span className="text-muted-foreground italic">No remarks recorded</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/20 p-4 sm:p-5">
            {!isReadOnly ? (
              <div className="flex justify-end gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => setIsViewModalOpen(false)}
                  disabled={isVerifySubmitting || isDetailLoading}
                  className="disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleVerifyQC()}
                  loading={isVerifySubmitting}
                  disabled={
                    Object.keys(validationErrors).length > 0 || isVerifySubmitting || isDetailLoading
                  }
                  className="disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100"
                >
                  Verify QC
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)} disabled={isDetailLoading}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
