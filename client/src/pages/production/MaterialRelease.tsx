import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format, parse, isValid } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronLeft, ChevronRight, Upload, Printer, Loader2, Check } from "lucide-react";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar, FilterField } from "@/components/shared/AppListToolbar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  OperationRelease,
  ProducedItem,
  aggregateProducedItems,
  parseBatchWiseOutputs,
} from "@/lib/releaseSharedData";
import { productionApi, commonApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { isMaterialReleaseStatusEntityName } from "@/services/loadCommonData";
import { useAuth } from "@/lib/store";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
  getAssignedIds,
  getFirstAssignedMatch,
  prioritizeByAssigned,
} from "@/utils/assignedDropdown";

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

const parseDateString = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  // Try DD-MM-YYYY first
  let parsed = parse(dateStr, "dd-MM-yyyy", new Date());
  if (isValid(parsed)) return parsed;
  // Fallback to YYYY-MM-DD
  parsed = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return parsed;
  return new Date();
};

function filterDateToApiYmd(ddMmYyyy: string | undefined | ""): string | undefined {
  if (!ddMmYyyy || !String(ddMmYyyy).trim()) return undefined;
  const p = parseDateString(String(ddMmYyyy).trim());
  if (!isValid(p)) return undefined;
  return format(p, "yyyy-MM-dd");
}

function mapMaterialReleaseListRecord(r: Record<string, any>): OperationRelease {
  const st = (r.status_name ?? r.status ?? "Issued to Warehouse") as string;
  return {
    id: Number(r.release_id ?? r.id),
    releaseNo: String(r.release_code ?? r.release_no ?? r.releaseCode ?? ""),
    releaseDate: String(r.release_date ?? r.releaseDate ?? "").slice(0, 10),
    operation: r.operation_name ?? r.operation ?? "",
    workCenter: r.work_center_name ?? r.workCenter ?? "",
    warehouse: r.warehouse_name ?? r.warehouse ?? "",
    releasedBy: r.released_by_name ?? r.released_by ?? r.created_by_name ?? "—",
    status:
      st === "Received By Warehouse" || (typeof st === "string" && st.toLowerCase().includes("received"))
        ? "Received By Warehouse"
        : "Issued to Warehouse",
    batchIds: (Array.isArray(r.batch_ids) ? r.batch_ids : Array.isArray(r.batch_nos) ? r.batch_nos : []) as string[],
    items: []
  };
}

/**
 * Map GET /getmaterialreleasebyid payload to OperationRelease (tolerates common key variants).
 */
function mapMaterialReleaseDetailPayload(d: Record<string, any>): OperationRelease {
  const st = (d.status_name ?? d.status ?? "Issued to Warehouse") as string;
  const toBatchIdStrings = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((b) => {
      if (b != null && typeof b === "object") {
        return String(
          (b as any).batch_no ?? (b as any).batch_code ?? (b as any).code ?? (b as any).id ?? ""
        );
      }
      return String(b);
    }).filter(Boolean);
  };
  const rawItems =
    d.items ?? d.produced_items ?? d.output_items ?? d.material_release_items ?? d.production_items ?? [];
  let items: ProducedItem[] = Array.isArray(rawItems)
    ? rawItems.map((r: any, i: number) => ({
        id: Number(r.item_id ?? r.id ?? i + 1),
        itemCode: String(r.item_code ?? r.itemCode ?? ""),
        itemName: String(r.item_name ?? r.itemName ?? ""),
        uom: String(r.uom_name ?? r.uom ?? ""),
        qtyProduced: Number(
          r.produced_qty ?? r.qty_produced ?? r.qtyProduced ?? r.qty ?? 0
        ),
        itemTypeCode: String(r.item_type_code ?? r.itemTypeCode ?? "")
      }))
    : [];

  const bwo = parseBatchWiseOutputs(
    d.batch_wise_outputs ?? d.batchWiseOutputs
  );
  if (items.length === 0 && bwo.lineItems.length > 0) {
    items = aggregateProducedItems(bwo.lineItems);
  }

  let batchIds: string[] = [];
  if (Array.isArray(d.batches) && d.batches.length) {
    batchIds = toBatchIdStrings(d.batches);
  } else if (Array.isArray(d.batch_ids) && d.batch_ids.length) {
    batchIds =
      typeof d.batch_ids[0] === "object"
        ? toBatchIdStrings(d.batch_ids)
        : d.batch_ids.map((x: any) => String(x));
  } else if (Array.isArray(d.batch_nos) && d.batch_nos.length) {
    batchIds = d.batch_nos.map((x: any) => String(x));
  }
  if (batchIds.length === 0 && bwo.batchIds.length > 0) {
    batchIds = bwo.batchIds;
  }

  const rawBatchDetails = d.batch_details ?? d.batchDetails;
  let batchDetails: OperationRelease["batchDetails"];
  if (Array.isArray(rawBatchDetails) && rawBatchDetails.length > 0) {
    batchDetails = rawBatchDetails.map((bd: any) => {
      const shiftVal = (bd.shift_name ?? bd.shift ?? "Morning") as string;
      const shift: string = String(shiftVal);
      const bItems = bd.items ?? bd.produced_items ?? [];
      return {
        batchNo: String(bd.batch_no ?? bd.batchNo ?? bd.batch_code ?? ""),
        shift,
        items: Array.isArray(bItems)
          ? bItems.map((r: any, i: number) => ({
              id: Number(r.item_id ?? r.id ?? i + 1),
              itemCode: String(r.item_code ?? r.itemCode ?? ""),
              itemName: String(r.item_name ?? r.itemName ?? ""),
              uom: String(r.uom_name ?? r.uom ?? ""),
              qtyProduced: Number(r.produced_qty ?? r.qty_produced ?? r.qtyProduced ?? 0),
              itemTypeCode: String(r.item_type_code ?? r.itemTypeCode ?? "")
            }))
          : []
      };
    });
  } else if (bwo.batchDetails.length > 0) {
    batchDetails = bwo.batchDetails;
  }

  return {
    id: Number(d.release_id ?? d.id),
    releaseNo: String(d.release_code ?? d.release_no ?? d.releaseCode ?? ""),
    releaseDate: String(d.release_date ?? d.releaseDate ?? "").slice(0, 10),
    operation: String(d.operation_name ?? d.operation ?? ""),
    workCenter: String(d.work_center_name ?? d.workCenter ?? ""),
    warehouse: String(d.warehouse_name ?? d.warehouse ?? ""),
    releasedBy: String(
      d.released_by_name ?? d.released_by_user_name ?? d.released_by ?? d.created_by_name ?? "—"
    ),
    status:
      st === "Received By Warehouse" || (typeof st === "string" && st.toLowerCase().includes("received"))
        ? "Received By Warehouse"
        : "Issued to Warehouse",
    batchIds,
    items,
    ...(batchDetails && batchDetails.length > 0 ? { batchDetails } : {})
  };
}

/**
 * Generate next release number
 */
const generateReleaseNumber = (existingReleases: OperationRelease[]): string => {
  const year = new Date().getFullYear();
  const count = existingReleases.filter(r => r.releaseNo.includes(`REL-${year}`)).length + 1;
  return `REL-${year}-${String(count).padStart(3, '0')}`;
};

const SERIAL_HEADER_KEYWORDS = ["serial", "number", "sr no", "sr_no", "code", "item"];

/** Parse serial column from sheet; skips header row when detected (matches UI count). */
function parseSerialNumbersFromWorksheet(worksheet: XLSX.WorkSheet): {
  serials: string[];
  hadHeader: boolean;
} {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
  if (!rows?.length) return { serials: [], hadHeader: false };

  const firstRow = rows[0] ?? [];
  const isHeader = firstRow.some(
    (cell) =>
      typeof cell === "string" &&
      SERIAL_HEADER_KEYWORDS.some((kw) => cell.toLowerCase().includes(kw))
  );

  let targetColIndex = 0;
  if (isHeader) {
    const foundIndex = firstRow.findIndex(
      (cell) =>
        typeof cell === "string" &&
        (cell.toLowerCase().includes("serial") || cell.toLowerCase().includes("sr no"))
    );
    if (foundIndex !== -1) targetColIndex = foundIndex;
  }

  const dataRows = isHeader ? rows.slice(1) : rows;
  const serials = dataRows
    .map((row) => String((row as unknown[])?.[targetColIndex] ?? "").trim())
    .filter(Boolean);

  return { serials, hadHeader: isHeader };
}

/** Backend counts every row in the uploaded file — send data rows only (no header). */
function buildSerialsOnlyExcelFile(serials: string[], originalFileName: string): File {
  const sheet = XLSX.utils.aoa_to_sheet(serials.map((s) => [s]));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Serials");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const baseName = String(originalFileName || "serials").replace(/\.(xlsx|xls|csv)$/i, "") || "serials";
  return new File([buffer], `${baseName}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

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
  /** API shift label, e.g. "Day Shift" (list UI); legacy mock used Morning/Night */
  shift: string;
  status: string;
  qcStatus: string;
  outputItems: ProducedItem[];
}

function mapGetBatchWithItemsToBatchTracking(
  r: Record<string, any>,
  operation: string,
  workCenter: string,
  warehouse: string
): BatchTracking {
  const rawItems = Array.isArray(r.items) ? r.items : [];
  const outputItems: ProducedItem[] = rawItems.map((it: any, i: number) => ({
    id: Number(it.item_id ?? it.id ?? i + 1),
    itemCode: String(it.item_code ?? it.itemCode ?? ""),
    itemName: String(it.item_name ?? it.itemName ?? ""),
    uom: String(it.uom_name ?? it.uom ?? ""),
    qtyProduced: Number(it.produced_qty ?? it.qtyProduced ?? 0),
    itemTypeCode: String(it.item_type_code ?? it.itemTypeCode ?? "")
  }));
  return {
    id: Number(r.batch_id ?? r.id),
    batchNo: String(r.batch_code ?? r.batchNo ?? ""),
    operation,
    workCenter,
    warehouse,
    shift: String(r.shift_name ?? r.shift ?? "—"),
    status: String(r.status_name ?? r.status ?? "—"),
    qcStatus: String(r.qc_status_name ?? r.qc_status ?? r.qcStatus ?? "—"),
    outputItems
  };
}

const resolveFormOperationId = (op: any): number | null => {
  const n = Number((op as any)?.operation_id ?? (op as any)?.id);
  return Number.isFinite(n) ? n : null;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MaterialRelease() {
  const { isMenuVisible, canCreate, canView } = useHasPermission();
  const permissionModule = "PRODUCTION/MATERIAL_RELEASE";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();
  const { user } = useAuth();

  // ============================================================================
  // STATE - LISTING PAGE
  // ============================================================================

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [operationFilter, setOperationFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingRelease, setViewingRelease] = useState<OperationRelease | null>(null);
  const [isViewDetailLoading, setIsViewDetailLoading] = useState(false);
  const [openingViewId, setOpeningViewId] = useState<number | null>(null);
  const [releases, setReleases] = useState<OperationRelease[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isListLoading, setIsListLoading] = useState(true);
  const [operations, setOperations] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const appliedOperationFilterDefault = useRef(false);
  const appliedStatusFilterDefault = useRef(false);
  const appliedFormWorkCenterDefault = useRef(false);
  const appliedFormOperationDefault = useRef(false);
  const appliedFormWarehouseDefault = useRef(false);
  const [areListFiltersReady, setAreListFiltersReady] = useState(
    () => getAssignedIds("operation").length === 0
  );

  const assignedOperationIds = getAssignedIds("operation");
  const assignedWorkcenterIds = getAssignedIds("workcenter");
  const assignedWarehouseIds = getAssignedIds("warehouse");
  const assignedOperationKey = assignedOperationIds.join(",");
  const assignedWorkcenterKey = assignedWorkcenterIds.join(",");

  const orderedListOperations = useMemo(
    () => prioritizeByAssigned(operations, assignedOperationIds, (o) => o.id || o.operation_id),
    [operations, assignedOperationKey]
  );

  const entityValues = useCommonStore((s) => s.entityValues);

  const materialReleaseStatusEntities = useMemo(() => {
    return (entityValues || []).filter((r: any) =>
      isMaterialReleaseStatusEntityName(
        r.entity_type_name,
        r.entity_type_code,
        r.entity_type_id
      )
    );
  }, [entityValues]);

  // ============================================================================
  // STATE - CREATE MODAL
  // ============================================================================

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState("");
  const [operationChangeTick, setOperationChangeTick] = useState(0);
  const [selectedWorkCenter, setSelectedWorkCenter] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [eligibleBatches, setEligibleBatches] = useState<BatchTracking[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);

  const [formData, setFormData] = useState({
    releaseNo: "",
    releaseDate: getCurrentDateForInput(),
    releasedBy: "Admin User", // TODO: Get from login context
  });

  const [selectedProductionPlan, setSelectedProductionPlan] = useState("");
  const [producedItems, setProducedItems] = useState<ProducedItem[]>([]);

  /** Create modal: work centers from GET /common/getworkcenters */
  const [formAssignedWorkCenters, setFormAssignedWorkCenters] = useState<
    { work_center_id: number; work_center_name: string }[]
  >([]);
  /** Create modal: operations from GET /common/getoperationwithworkcenter?work_center_id= */
  const [formWorkCenterOperations, setFormWorkCenterOperations] = useState<any[]>([]);
  const [selectedWorkCenterId, setSelectedWorkCenterId] = useState<number | null>(null);
  const [isLoadingFormWorkCenters, setIsLoadingFormWorkCenters] = useState(false);
  const [isLoadingFormOperations, setIsLoadingFormOperations] = useState(false);
  const [isLoadingFormWarehouses, setIsLoadingFormWarehouses] = useState(false);
  /** common/getwarehouses for create modal */
  const [formWarehouses, setFormWarehouses] = useState<{ id: number; name: string }[]>([]);
  /** common/getproductionplan?operation_id= */
  const [formProductionPlans, setFormProductionPlans] = useState<
    { production_plan_id: number; plan_code: string; display_name: string; operation_id: number }[]
  >([]);
  const [isLoadingFormProductionPlans, setIsLoadingFormProductionPlans] = useState(false);
  const [isLoadingEligibleBatches, setIsLoadingEligibleBatches] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [latestCreatedReleaseId, setLatestCreatedReleaseId] = useState<number | null>(null);

  // Serial Numbers for batches/items: Record<batchNo, Record<itemCode, serialNumbers[]>>
  const [batchSerialNumbers, setBatchSerialNumbers] = useState<Record<string, Record<string, string[]>>>({});
  const [batchFiles, setBatchFiles] = useState<Record<string, Record<string, File>>>({});

  // ============================================================================
  // EFFECTS - list API + master dropdowns
  // ============================================================================

  useEffect(() => {
    const load = async () => {
      try {
        const [opRes, shiftRes] = await Promise.all([
          commonApi.getOperations(),
          productionApi.getShiftForProduction()
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
              setOperationFilter(String(op.operation_name || op.name || "").trim());
              appliedOperationFilterDefault.current = true;
            }
          }
        }
        if (shiftRes.isSuccessful && shiftRes.data?.records) {
          setShifts(shiftRes.data.records);
        }
      } catch (e) {
        console.error("Material Release filter masters failed", e);
      } finally {
        setAreListFiltersReady(true);
      }
    };
    void load();
  }, []);

  // Operation Masters with QC requirements
  const operationMasters: OperationMaster[] = [
    { operation: "Lead Generation & Purification", qcRequired: true },
    { operation: "Case Creation", qcRequired: false },
    { operation: "Grid Creation & Oxidization", qcRequired: true },
    { operation: "Assembly line & Packaging", qcRequired: true },
  ];

  const operationSelectOptions = useMemo(() => {
    if (orderedListOperations.length > 0) {
      return [
        { label: "All Operations", value: "all" },
        ...orderedListOperations
          .map((o) => ({
            label: String(o.operation_name || o.name || "").trim(),
            value: String(o.operation_name || o.name || "").trim()
          }))
          .filter((o) => o.value)
      ];
    }
    return [
      { label: "All Operations", value: "all" },
      ...operationMasters.map((om) => ({ label: om.operation, value: om.operation }))
    ];
  }, [orderedListOperations]);

  const statusSelectOptions = useMemo(() => {
    const fromEntities = materialReleaseStatusEntities
      .map((e: any) => ({
        label: String(e.value_name || e.name || e.status_name || "").trim(),
        value: String(e.status_id ?? e.id).trim()
      }))
      .filter((o) => o.value);
    if (fromEntities.length > 0) {
      return [{ label: "All Status", value: "all" }, ...fromEntities];
    }
    return [
      { label: "All Status", value: "all" },
      { label: "Issued to Warehouse", value: "Issued to Warehouse" },
      { label: "Received By Warehouse", value: "Received By Warehouse" }
    ];
  }, [materialReleaseStatusEntities]);

  const shiftSelectOptions = useMemo(() => {
    if (!shifts.length) {
      return [{ label: "All Shifts", value: "all" }];
    }
    return [
      { label: "All Shifts", value: "all" },
      ...shifts
        .map((s) => ({
          label: String(s.shift_name || s.name || s.value_name || "").trim(),
          value: String(s.shift_name || s.name || s.value_name || "").trim()
        }))
        .filter((o) => o.value)
    ];
  }, [shifts]);

  // Default list status filter to "Issued to Warehouse" (dynamic from entity values).
  useEffect(() => {
    if (appliedStatusFilterDefault.current) return;

    if (!Array.isArray(materialReleaseStatusEntities) || materialReleaseStatusEntities.length === 0) {
      const timer = setTimeout(() => {
        if (!appliedStatusFilterDefault.current) {
          setStatusFilter("all");
          appliedStatusFilterDefault.current = true;
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    const issued = materialReleaseStatusEntities.find((e: any) => {
      const name = String(e.value_name || e.name || e.status_name || "").trim().toLowerCase();
      return name === "issued to warehouse";
    });
    const issuedId = issued != null ? String((issued as any).status_id ?? (issued as any).id ?? "").trim() : "";

    setStatusFilter(issuedId || "all");
    appliedStatusFilterDefault.current = true;
  }, [materialReleaseStatusEntities]);

  // Sample operation releases data moved to releaseSharedData.ts

  const fetchMaterialReleaseList = useCallback(async (pageOverride?: number) => {
    if (!areListFiltersReady) return;
    setIsListLoading(true);
    const page = pageOverride ?? currentPage;
    try {
      const op =
        operationFilter === "all"
          ? undefined
          : operations.find(
              (o) => (o.operation_name || o.name) === operationFilter
            );
      const sh =
        shiftFilter === "all"
          ? undefined
          : shifts.find(
              (s) => (s.shift_name || s.name || s.value_name) === shiftFilter
            );
      const statusId =
        statusFilter === "" || statusFilter === "all"
          ? undefined
          : Number(statusFilter);
      const res = await productionApi.getMaterialReleaseList({
        page,
        limit: itemsPerPage,
        search: debouncedSearchTerm?.trim() || undefined,
        date: filterDateToApiYmd(filterDate),
        operation_id: (() => {
          if (op == null) return undefined;
          const n = Number((op as any).id ?? (op as any).operation_id);
          return !Number.isNaN(n) && Number.isFinite(n) ? n : undefined;
        })(),
        status_id:
          statusId != null && !Number.isNaN(statusId) && Number.isFinite(statusId)
            ? statusId
            : undefined,
        shift_id: (() => {
          if (sh == null) return undefined;
          const n = Number((sh as any).shift_id ?? (sh as any).id);
          return !Number.isNaN(n) && Number.isFinite(n) ? n : undefined;
        })()
      });
      if (res.isSuccessful && res.data) {
        setReleases(
          (res.data.records || []).map((r) => mapMaterialReleaseListRecord(r as Record<string, any>))
        );
        setTotalRecords(res.data.pagination?.totalRecords ?? 0);
      } else {
        setReleases([]);
        setTotalRecords(0);
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Failed to load material releases"
        });
      }
    } catch (e) {
      setReleases([]);
      setTotalRecords(0);
      toast({ variant: "destructive", title: "Error", description: "Failed to load material releases" });
    } finally {
      setIsListLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
    statusFilter,
    operationFilter,
    shiftFilter,
    filterDate,
    operations,
    shifts,
    areListFiltersReady,
    toast,
  ]);

  const isRowActionBusy = openingViewId !== null || isViewDetailLoading;

  useEffect(() => {
    if (statusFilter === "") return; // Wait for default status
    void fetchMaterialReleaseList();
  }, [fetchMaterialReleaseList, statusFilter]);

  // Create modal: work centers (assigned) + warehouses (common) when the dialog opens
  useEffect(() => {
    if (!isCreateModalOpen) return;
    let cancelled = false;
    (async () => {
      setIsLoadingFormWorkCenters(true);
      setIsLoadingFormWarehouses(true);
      try {
        const [wcRes, whRes] = await Promise.all([
          commonApi.getWorkCenters(),
          commonApi.getWarehouses()
        ]);
        if (cancelled) return;
        if (wcRes.isSuccessful && Array.isArray(wcRes.data?.records)) {
          const records = wcRes.data.records
            .map((r: any) => ({
              work_center_id: Number(r.id ?? r.work_center_id),
              work_center_name: String(r.work_center_name || r.name || r.value_name || "").trim()
            }))
            .filter(
              (r: { work_center_id: number; work_center_name: string }) =>
                r.work_center_name && Number.isFinite(r.work_center_id)
            );
          const ordered = prioritizeByAssigned<{ work_center_id: number; work_center_name: string }>(
            records,
            assignedWorkcenterIds,
            (w) => w.work_center_id
          );
          setFormAssignedWorkCenters(ordered);
          if (
            !appliedFormWorkCenterDefault.current &&
            assignedWorkcenterIds.length > 0 &&
            ordered.length > 0
          ) {
            const firstAssigned = getFirstAssignedMatch(
              assignedWorkcenterIds,
              ordered.map((w) => w.work_center_id)
            );
            if (firstAssigned) {
              const row = ordered.find((w) => String(w.work_center_id) === firstAssigned);
              if (row) {
                setSelectedWorkCenterId(row.work_center_id);
                setSelectedWorkCenter(row.work_center_name);
                appliedFormWorkCenterDefault.current = true;
              }
            }
          }
        } else {
          setFormAssignedWorkCenters([]);
        }
        if (whRes.isSuccessful && Array.isArray(whRes.data?.records)) {
          const warehouseRecords = whRes.data.records
            .map((r: any) => ({
              id: Number(r.id ?? r.warehouse_id),
              name: String(r.warehouse_name ?? r.name ?? "").trim()
            }))
            .filter((r: { id: number; name: string }) => r.name && Number.isFinite(r.id));
          const orderedWarehouses = prioritizeByAssigned<{ id: number; name: string }>(
            warehouseRecords,
            assignedWarehouseIds,
            (wh) => wh.id
          );
          setFormWarehouses(orderedWarehouses);
          if (
            !appliedFormWarehouseDefault.current &&
            assignedWarehouseIds.length > 0 &&
            orderedWarehouses.length > 0
          ) {
            const firstAssigned = getFirstAssignedMatch(
              assignedWarehouseIds,
              orderedWarehouses.map((wh) => wh.id)
            );
            if (firstAssigned) {
              const row = orderedWarehouses.find((wh) => String(wh.id) === firstAssigned);
              if (row) {
                setSelectedWarehouseId(row.id);
                setSelectedWarehouse(row.name);
                appliedFormWarehouseDefault.current = true;
              }
            }
          }
        } else {
          setFormWarehouses([]);
        }
      } catch {
        if (!cancelled) {
          setFormAssignedWorkCenters([]);
          setFormWarehouses([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFormWorkCenters(false);
          setIsLoadingFormWarehouses(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreateModalOpen]);

  // Create modal: operations for the selected work center
  useEffect(() => {
    if (!isCreateModalOpen) {
      setFormWorkCenterOperations([]);
      return;
    }
    if (selectedWorkCenterId == null) {
      setFormWorkCenterOperations([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingFormOperations(true);
      try {
        const res = await commonApi.getOperationWithWorkCenter(selectedWorkCenterId);
        if (cancelled) return;
        if (res.isSuccessful && Array.isArray(res.data?.records)) {
          const records = res.data.records;
          const ordered = prioritizeByAssigned(
            records,
            assignedOperationIds,
            (o) => resolveFormOperationId(o) ?? ""
          );
          setFormWorkCenterOperations(ordered);
          if (
            !appliedFormOperationDefault.current &&
            assignedOperationIds.length > 0 &&
            ordered.length > 0
          ) {
            const availableOpIds = ordered
              .map((o) => resolveFormOperationId(o))
              .filter((id): id is number => id != null);
            const firstAssigned = getFirstAssignedMatch(assignedOperationIds, availableOpIds);
            if (firstAssigned) {
              const opRow = ordered.find(
                (o) => String(resolveFormOperationId(o)) === firstAssigned
              );
              const opId = resolveFormOperationId(opRow);
              if (opId != null) {
                setSelectedOperation(String(opId));
                appliedFormOperationDefault.current = true;
              }
            }
          }
        } else {
          setFormWorkCenterOperations([]);
        }
      } catch {
        if (!cancelled) setFormWorkCenterOperations([]);
      } finally {
        if (!cancelled) setIsLoadingFormOperations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreateModalOpen, selectedWorkCenterId]);

  // Create modal: production plans for the selected operation (common/getproductionplan?operation_id=)
  useEffect(() => {
    if (!isCreateModalOpen) {
      setFormProductionPlans([]);
      return;
    }
    if (!selectedOperation) {
      setFormProductionPlans([]);
      return;
    }
    const selOpId = Number(selectedOperation);
    const opRow = formWorkCenterOperations.find(
      (o) => resolveFormOperationId(o) === selOpId
    );
    const operationId = resolveFormOperationId(opRow);
    if (opRow == null || operationId == null) {
      setFormProductionPlans([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingFormProductionPlans(true);
      try {
        const res = await commonApi.getProductionPlans({ operation_id: operationId });
        if (cancelled) return;
        if (res.isSuccessful && Array.isArray(res.data?.records)) {
          setFormProductionPlans(res.data.records);
        } else {
          setFormProductionPlans([]);
        }
      } catch {
        if (!cancelled) setFormProductionPlans([]);
      } finally {
        if (!cancelled) setIsLoadingFormProductionPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreateModalOpen, selectedOperation, formWorkCenterOperations, operationChangeTick]);

  // Eligible batches: GET /common/getbatchwithitems?operation_id= (from selected operation row)
  useEffect(() => {
    if (!isCreateModalOpen || !selectedOperation || !selectedWorkCenter || !selectedWarehouse) {
      setEligibleBatches([]);
      setSelectedBatchIds([]);
      setProducedItems([]);
      setIsLoadingEligibleBatches(false);
      return;
    }
    const selOpId = Number(selectedOperation);
    const opRow = formWorkCenterOperations.find(
      (o) => resolveFormOperationId(o) === selOpId
    );
    const operationId = resolveFormOperationId(opRow);
    if (opRow == null || operationId == null) {
      setEligibleBatches([]);
      setSelectedBatchIds([]);
      setProducedItems([]);
      setIsLoadingEligibleBatches(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingEligibleBatches(true);
      setSelectedBatchIds([]);
      setProducedItems([]);
      try {
        const res = await commonApi.getBatchWithItems({ operation_id: operationId });
        if (cancelled) return;
        if (res.isSuccessful && Array.isArray((res as any).data?.records)) {
          const records = (res as any).data.records as Record<string, any>[];
          const operationLabel = String(
            (opRow as any)?.operation_name ?? (opRow as any)?.name ?? (opRow as any)?.operation ?? ""
          ).trim();
          setEligibleBatches(
            records.map((r) =>
              mapGetBatchWithItemsToBatchTracking(
                r,
                operationLabel,
                selectedWorkCenter,
                selectedWarehouse
              )
            )
          );
        } else {
          setEligibleBatches([]);
        }
      } catch {
        if (!cancelled) setEligibleBatches([]);
      } finally {
        if (!cancelled) setIsLoadingEligibleBatches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isCreateModalOpen,
    selectedOperation,
    selectedWorkCenter,
    selectedWarehouse,
    formWorkCenterOperations,
    operationChangeTick
  ]);

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
              itemTypeCode: item.itemTypeCode,
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
   * Open view modal and load full record from GET /getmaterialreleasebyid/:id
   */
  const handleViewRelease = async (release: OperationRelease) => {
    if (openingViewId !== null || isViewDetailLoading) return;
    if (release.id == null || !Number.isFinite(release.id)) {
      toast({
        title: "Error",
        description: "Invalid release to view.",
        variant: "destructive"
      });
      return;
    }
    setOpeningViewId(release.id);
    setViewingRelease(null);
    setIsViewDetailLoading(true);
    setIsViewModalOpen(true);
    try {
      const res = await productionApi.getMaterialReleaseById(release.id);
      if (res.isSuccessful) {
        const raw = (res as any).data;
        const payload =
          raw && typeof raw === "object" && (raw as any).data && typeof (raw as any).data === "object"
            ? (raw as any).data
            : raw;
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          setViewingRelease(mapMaterialReleaseDetailPayload(payload as Record<string, any>));
        } else {
          setViewingRelease(release);
          toast({
            title: "Notice",
            description: "No detail payload; showing list row.",
            variant: "default"
          });
        }
      } else {
        setViewingRelease(release);
        toast({
          title: "Error",
          description: (res as any).message || "Failed to load release details. Showing list row.",
          variant: "destructive"
        });
      }
    } catch {
      setViewingRelease(release);
      toast({
        title: "Error",
        description: "Failed to load release details. Showing list row.",
        variant: "destructive"
      });
    } finally {
      setIsViewDetailLoading(false);
      setOpeningViewId(null);
    }
  };

  /**
   * Open create modal to add new release
   */
  const handleAddRelease = () => {
    if (openingViewId !== null || isViewDetailLoading || isSubmittingCreate) return;
    appliedFormWorkCenterDefault.current = false;
    appliedFormOperationDefault.current = false;
    appliedFormWarehouseDefault.current = false;
    setLatestCreatedReleaseId(null);
    setSelectedWorkCenterId(null);
    setSelectedWorkCenter("");
    setSelectedOperation("");
    setOperationChangeTick(0);
    setFormWorkCenterOperations([]);
    setSelectedWarehouse("");
    setSelectedWarehouseId(null);
    setFormProductionPlans([]);
    setEligibleBatches([]);
    setSelectedBatchIds([]);
    setProducedItems([]);
    setSelectedProductionPlan("");
    setBatchSerialNumbers({});
    setBatchFiles({});

    setFormData((prev) => ({
      ...prev,
      releaseNo: generateReleaseNumber(releases),
      releaseDate: getCurrentDateForInput(),
    }));

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
    appliedFormWorkCenterDefault.current = false;
    appliedFormOperationDefault.current = false;
    appliedFormWarehouseDefault.current = false;
    setLatestCreatedReleaseId(null);

    // Reset form
    setSelectedOperation("");
    setOperationChangeTick(0);
    setSelectedWorkCenter("");
    setSelectedWorkCenterId(null);
    setFormWorkCenterOperations([]);
    setSelectedWarehouse("");
    setSelectedWarehouseId(null);
    setFormProductionPlans([]);
    setEligibleBatches([]);
    setSelectedBatchIds([]);
    setProducedItems([]);
    setSelectedProductionPlan("");
    setBatchSerialNumbers({});
    setBatchFiles({});
  };

  /**
   * Handle operation selection change
   * Resets batches and production plan (work center is unchanged)
   */
  const handleOperationChange = (operation: string) => {
    appliedFormOperationDefault.current = true;
    setSelectedOperation(operation);
    setEligibleBatches([]);
    setSelectedBatchIds([]);
    setProducedItems([]);
    setSelectedProductionPlan("");
    setFormProductionPlans([]);
    if (operation) {
      setOperationChangeTick((t) => t + 1);
    }
  };

  /**
   * Work center from GET /common/getworkcenters; then operations load via
   * GET /common/getoperationwithworkcenter?work_center_id=
   */
  const handleWorkCenterChange = (workCenterIdStr: string) => {
    appliedFormOperationDefault.current = false;
    if (!workCenterIdStr) {
      setSelectedWorkCenterId(null);
      setSelectedWorkCenter("");
      setSelectedOperation("");
      setFormWorkCenterOperations([]);
      setSelectedWarehouse("");
      setSelectedWarehouseId(null);
      setFormProductionPlans([]);
      setSelectedProductionPlan("");
      setEligibleBatches([]);
      setSelectedBatchIds([]);
      setProducedItems([]);
      return;
    }
    const id = Number(workCenterIdStr);
    const row = formAssignedWorkCenters.find((w) => w.work_center_id === id);
    setSelectedWorkCenterId(Number.isFinite(id) ? id : null);
    setSelectedWorkCenter(row?.work_center_name ?? "");
    setSelectedOperation("");
    setSelectedWarehouse("");
    setSelectedWarehouseId(null);
    setFormProductionPlans([]);
    setSelectedProductionPlan("");
    setEligibleBatches([]);
    setSelectedBatchIds([]);
    setProducedItems([]);
  };

  const handleWarehouseChange = (warehouseIdStr: string) => {
    if (!warehouseIdStr) {
      setSelectedWarehouseId(null);
      setSelectedWarehouse("");
      return;
    }
    const id = Number(warehouseIdStr);
    const row = formWarehouses.find((w) => w.id === id);
    setSelectedWarehouseId(Number.isFinite(id) ? id : null);
    setSelectedWarehouse(row?.name ?? "");
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
  const handleSubmit = async () => {
    if (!selectedProductionPlan) {
      toast({
        title: "Validation Error",
        description: "Please select a Production Plan",
        variant: "destructive",
      });
      return;
    }

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

    // Frontend validation: for Finished Goods, serial numbers must be imported before issuing
    const selectedBatches = eligibleBatches.filter((b) => selectedBatchIds.includes(b.id));
    const hasMissingFGSerials = selectedBatches.some((batch) => {
      const fgItems = (batch.outputItems || []).filter(
        (item: any) => String(item.itemTypeCode || "").trim().toUpperCase() === "FG"
      );
      return fgItems.some((item: any) => {
        const expectedQty = Number(item.qtyProduced || 0);
        const importedCount =
          batchSerialNumbers?.[batch.batchNo]?.[item.itemCode]?.length || 0;
        return expectedQty > 0 && importedCount !== expectedQty;
      });
    });

    if (hasMissingFGSerials) {
      toast({
        title: "Validation Error",
        description: "Serial numbers are required for Finished Goods. Please import serial numbers before issuing.",
        variant: "destructive",
      });
      return;
    }

    if (user == null || user.id == null) {
      toast({
        title: "Session required",
        description: "Sign in to create a material release.",
        variant: "destructive",
      });
      return;
    }

    const selOpId = Number(selectedOperation);
    const opRow = formWorkCenterOperations.find(
      (o) => resolveFormOperationId(o) === selOpId
    );
    const operationId = resolveFormOperationId(opRow);
    if (opRow == null || operationId == null) {
      toast({
        title: "Validation Error",
        description: "Could not resolve operation. Please re-select work center and operation.",
        variant: "destructive",
      });
      return;
    }

    if (selectedWorkCenterId == null || !Number.isFinite(selectedWorkCenterId)) {
      toast({
        title: "Validation Error",
        description: "Work center is required.",
        variant: "destructive",
      });
      return;
    }

    if (selectedWarehouseId == null || !Number.isFinite(selectedWarehouseId)) {
      toast({
        title: "Validation Error",
        description: "Warehouse is required.",
        variant: "destructive",
      });
      return;
    }

    const productionPlanId = Number(selectedProductionPlan);
    if (!Number.isFinite(productionPlanId)) {
      toast({
        title: "Validation Error",
        description: "Invalid production plan.",
        variant: "destructive",
      });
      return;
    }

    const releaseDateYmd = String(formData.releaseDate || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDateYmd)) {
      toast({
        title: "Validation Error",
        description: "Release date must be in YYYY-MM-DD format.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingCreate(true);
    try {
      // ✅ Step 1: Import Serials (Single API call for all batches) using dynamic FormData
      const batchFileEntries = Object.entries(batchFiles);
      if (batchFileEntries.length > 0) {
        const formData = new FormData();
        
        for (const [batchNo, items] of batchFileEntries) {
          const batch = eligibleBatches.find(b => b.batchNo === batchNo);
          if (!batch) continue;

          for (const [itemCode, fileObj] of Object.entries(items)) {
            if (fileObj) {
              // As per Postman screenshot: 
              // 1. Repeat "batch_id" field
              // 2. Use dynamic file key: "file[batch_id]"
              formData.append("batch_id", String(batch.id));
              formData.append(`file[${batch.id}]`, fileObj);
            }
          }
        }

        // Call API ONCE with all batches combined
        const importRes = await productionApi.importMaterialReleaseSerials(formData);
        
        if (!importRes.isSuccessful) {
          toast({
            variant: "destructive",
            title: "Serial Import Failed",
            description: importRes.message || "Failed to import serial numbers. Process stopped."
          });
          setIsSubmittingCreate(false);
          return; // STOP EXECUTION
        }
        
        toast({
          variant: "success",
          title: "Serials Imported",
          description: "All serial numbers have been successfully validated and imported."
        });
      }

      // ✅ Step 2: Create Material Release ONLY IF STEP 1 SUCCEEDS
      const res = await productionApi.createMaterialRelease({
        release_date: releaseDateYmd,
        released_by: user.id,
        operation_id: operationId,
        work_center_id: selectedWorkCenterId,
        warehouse_id: selectedWarehouseId,
        production_plan_id: productionPlanId,
        batch_ids: selectedBatchIds,
      });

      if (!res.isSuccessful) {
        toast({
          variant: "destructive",
          title: "Release Creation Failed",
          description: res.message || "Serials were imported, but release creation failed.",
        });
        setIsSubmittingCreate(false);
        return;
      }

      const rawData = (res as any).data;
      const resolvedReleaseId = Number(
        rawData?.release_id ??
        rawData?.id ??
        rawData?.material_release_id ??
        rawData?.data?.release_id ??
        rawData?.data?.id
      );
      const release_id = Number.isFinite(resolvedReleaseId) ? resolvedReleaseId : null;
      setLatestCreatedReleaseId(release_id);

      // ✅ Step 3: Finalize
      setCurrentPage(1);
      void fetchMaterialReleaseList(1);
      toast({
        variant: "success",
        title: "Success",
        description: res.message || "Material release issued to warehouse successfully.",
      });
      
      setIsCreateModalOpen(false);
      setSelectedOperation("");
      setSelectedWorkCenter("");
      setSelectedWorkCenterId(null);
      setSelectedWarehouse("");
      setSelectedWarehouseId(null);
      setFormWorkCenterOperations([]);
      setFormProductionPlans([]);
      setEligibleBatches([]);
      setSelectedBatchIds([]);
      setProducedItems([]);
      setBatchSerialNumbers({});
      setBatchFiles({});
      setSelectedProductionPlan("");

    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: error.message || "An unexpected error occurred."
      });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  /**
   * Handle Excel import for serial numbers
   */
  const handleImportSerialNumbers = async (
    batchId: number,
    batchNo: string,
    itemCode: string,
    file: File,
    expectedQty: number
  ) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const { serials: importedSerials, hadHeader } = parseSerialNumbersFromWorksheet(worksheet);

          if (!importedSerials.length) {
            toast({
              title: "Import Error",
              description: "No serial numbers found in the file.",
              variant: "destructive",
            });
            return;
          }

          // Strict validation: count must match exactly
          if (importedSerials.length !== expectedQty) {
            toast({
              title: "Quantity Mismatch",
              description: `Expected exactly ${expectedQty} serials, but found ${importedSerials.length} in file. Typing/Import blocked.`,
              variant: "destructive",
            });
            return;
          }

          // Store serials for UI count
          setBatchSerialNumbers((prev) => ({
            ...prev,
            [batchNo]: {
              ...prev[batchNo],
              [itemCode]: importedSerials,
            },
          }));

          // Upload a data-only file so backend row count matches frontend (backend counts all rows, including header).
          const fileForApi = buildSerialsOnlyExcelFile(importedSerials, file.name);
          setBatchFiles((prev) => ({
            ...prev,
            [batchNo]: {
              ...prev[batchNo],
              [itemCode]: fileForApi,
            },
          }));

          toast({
            variant: "success",
            title: "File Validated",
            description: hadHeader
              ? `${importedSerials.length} serials ready (header row excluded from upload).`
              : `${importedSerials.length} serials parsed and ready for submission.`,
          });
        } catch (err) {
          console.error("Excel parse error:", err);
          toast({
            title: "Import Error",
            description: "Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Import serials error:", error);
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Failed to import serial numbers.",
        variant: "destructive",
      });
    }
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
  // SERVER PAGINATION (getmaterialreleaselist)
  // ============================================================================

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // ============================================================================
  // RENDER - LISTING PAGE
  // ============================================================================

  const formOperationSelectOptions = useMemo(() => {
    return formWorkCenterOperations
      .map((op) => {
        const id = resolveFormOperationId(op);
        const label = String(
          (op as any).operation_name || (op as any).name || (op as any).operation || ""
        ).trim();
        if (id == null || !label) return null;
        const code = String((op as any).operation_code || (op as any).code || "").trim() || `OP${String(id).padStart(3, "0")}`;
        return {
          value: String(id),
          label: `${label} — ${code}`,
          primaryText: label,
          secondaryText: code,
        };
      })
      .filter((o): o is { value: string; label: string; primaryText: string; secondaryText: string } => o != null);
  }, [formWorkCenterOperations]);

  const formProductionPlanOptions = useMemo(
    () =>
      formProductionPlans.map((p) => ({
        value: String(p.production_plan_id),
        label: p.display_name || p.plan_code
      })),
    [formProductionPlans]
  );

  // Check if primary button should be disabled (used in create modal)
  const isPrimaryButtonDisabled =
    isSubmittingCreate ||
    !selectedProductionPlan ||
    !selectedOperation ||
    !selectedWorkCenter ||
    !selectedWarehouse ||
    selectedBatchIds.length === 0;

  // Check if any selected item is Finished Good (FG)
  const isFGProduced = producedItems.some(
    (item) => String(item.itemTypeCode || "").trim().toUpperCase() === "FG"
  );
  const selectedBatches = eligibleBatches.filter((b) => selectedBatchIds.includes(b.id));

  const hasMissingFGSerials = useMemo(() => {
    if (!isFGProduced || selectedBatches.length === 0) return false;
    return selectedBatches.some((batch) => {
      const fgItems = (batch.outputItems || []).filter(
        (item: any) => String(item.itemTypeCode || "").trim().toUpperCase() === "FG"
      );
      return fgItems.some((item: any) => {
        const expectedQty = Number(item.qtyProduced || 0);
        const importedCount =
          batchSerialNumbers?.[batch.batchNo]?.[item.itemCode]?.length || 0;
        return expectedQty > 0 && importedCount !== expectedQty;
      });
    });
  }, [isFGProduced, selectedBatches, batchSerialNumbers]);

  const isPrimaryButtonDisabledWithFG =
    isPrimaryButtonDisabled || (isFGProduced && hasMissingFGSerials);

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
          onChange: (v) => {
            setSearchTerm(v);
            setCurrentPage(1);
          },
          placeholder: "Search by Release Code"
        }}
        filters={[
          {
            type: 'select',
            label: 'Operation',
            value: operationFilter,
            options: operationSelectOptions,
            onChange: (v) => {
              setOperationFilter(v);
              setCurrentPage(1);
            },
            searchable: true
          },
          {
            type: 'date',
            label: 'Date',
            value: filterDate ? parseDateString(filterDate) : undefined,
            onChange: (date) => {
              setFilterDate(date ? format(date, "dd-MM-yyyy") : "");
              setCurrentPage(1);
            },
            showClear: !!filterDate
          },
          {
            type: 'select',
            label: 'Status',
            value: statusFilter,
            options: statusSelectOptions,
            onChange: (v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            },
            searchable: true
          },
          {
            type: 'select',
            label: 'Shift',
            value: shiftFilter,
            options: shiftSelectOptions,
            onChange: (v) => {
              setShiftFilter(v);
              setCurrentPage(1);
            },
            searchable: true
          }
        ]}
        actions={[
          ...(canCreate(permissionModule) ? [{
            label: "Create Material Release",
            icon: <Plus className="h-4 w-4" />,
            onClick: handleAddRelease,
          }] : [])
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
                  <TableHead>Release Code</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Work Center</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!areListFiltersReady || isListLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : releases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No releases found.
                    </TableCell>
                  </TableRow>
                ) : (
                  releases.map((release) => (
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
                      <TableCell className="text-center">
                        <div className={cn(isRowActionBusy && "pointer-events-none opacity-50")}>
                          <TableActionButtons
                            onView={canView(permissionModule) ? () => handleViewRelease(release) : undefined}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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

      {/* View Release Modal */}
      <Dialog
        open={isViewModalOpen}
        onOpenChange={(open) => {
          setIsViewModalOpen(open);
          if (!open) {
            setViewingRelease(null);
            setIsViewDetailLoading(false);
          }
        }}
      >
        <DialogContent
          className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b p-4 pb-2 sm:p-5 sm:pb-3">
            <DialogTitle className="text-lg font-bold sm:text-xl">Release Details</DialogTitle>
            <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
              View operation release details
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
            {isViewDetailLoading && (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 sm:min-h-[320px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            )}
            {!isViewDetailLoading && viewingRelease && (
              <div className="space-y-5">
                {/* Header Info */}
                <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5 lg:grid-cols-3">
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Release Code</Label>
                    <p className="truncate text-sm font-semibold" title={viewingRelease.releaseNo}>
                      {viewingRelease.releaseNo}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Release Date</Label>
                    <p className="text-sm font-semibold">{formatDate(viewingRelease.releaseDate)}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                    <div className="pt-0.5">
                      <Badge
                        variant={viewingRelease.status === "Issued to Warehouse" ? "default" : "secondary"}
                        className="whitespace-nowrap w-fit px-2.5 py-0.5"
                      >
                        {viewingRelease.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Released By</Label>
                    <p className="truncate text-sm font-semibold" title={viewingRelease.releasedBy}>
                      {viewingRelease.releasedBy}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operation</Label>
                    <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={viewingRelease.operation}>
                      {viewingRelease.operation}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Work Center</Label>
                    <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={viewingRelease.workCenter}>
                      {viewingRelease.workCenter}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Warehouse</Label>
                    <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={viewingRelease.warehouse}>
                      {viewingRelease.warehouse}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batches</Label>
                    <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug">
                      {viewingRelease.batchIds.length ? viewingRelease.batchIds.join(", ") : "—"}
                    </p>
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
                          <TableHead>Batch Code</TableHead>
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
                      {viewingRelease.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                            No line items
                          </TableCell>
                        </TableRow>
                      ) : (
                        viewingRelease.items.map((item) => (
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
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/20 p-4 sm:p-5">
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
        <DialogContent
          className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
            <DialogTitle className="text-lg font-bold sm:text-xl">Create Material Release</DialogTitle>
            <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
              Release produced output from production operations to warehouse
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
            <div className="space-y-5">
              {/* Header Summary Section */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                {/* Auto-filled fields (read-only) */}
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Release Date</Label>
                  <div
                    className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-foreground tabular-nums"
                    aria-readonly="true"
                  >
                    {formData.releaseDate ? formatDate(formData.releaseDate) : ""}
                  </div>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Released By</Label>
                  <div
                    className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-foreground"
                    aria-readonly="true"
                  >
                    {formData.releasedBy}
                  </div>
                </div>

                {/* Required dropdowns */}
                <div className="min-w-0">
                  <SharedSearchableSelect
                    label="Work Center"
                    required
                    value={selectedWorkCenterId != null ? String(selectedWorkCenterId) : ""}
                    onChange={(val) => handleWorkCenterChange(String(val))}
                    options={formAssignedWorkCenters.map((wc) => ({
                      value: String(wc.work_center_id),
                      label: wc.work_center_name
                    }))}
                    placeholder={isLoadingFormWorkCenters ? "Loading..." : "Select Work Center"}
                    disabled={isLoadingFormWorkCenters}
                    className="h-9"
                    listClassName="max-h-[200px]"
                  />
                </div>

                <div className="min-w-0">
                  <SharedSearchableSelect
                    label="Operation"
                    required
                    value={selectedOperation}
                    onChange={(val) => handleOperationChange(String(val))}
                    options={formOperationSelectOptions}
                    placeholder={
                      selectedWorkCenterId == null
                        ? "Select a work center first"
                        : isLoadingFormOperations
                          ? "Loading operations..."
                          : "Select Operation"
                    }
                    disabled={selectedWorkCenterId == null || isLoadingFormOperations}
                    showSelectedTitle
                    selectedPrimaryLineClamp={2}
                    className="h-auto min-h-[52px] items-start! py-0.5"
                    listClassName="max-h-[220px]"
                  />
                </div>

                <div className="min-w-0">
                  <SharedSearchableSelect
                    label="Warehouse"
                    required
                    value={selectedWarehouseId != null ? String(selectedWarehouseId) : ""}
                    onChange={(val) => handleWarehouseChange(String(val))}
                    options={formWarehouses.map((w) => ({
                      value: String(w.id),
                      label: w.name
                    }))}
                    placeholder={isLoadingFormWarehouses ? "Loading..." : "Select Warehouse"}
                    disabled={isLoadingFormWarehouses}
                    className="h-9"
                    listClassName="max-h-[200px]"
                  />
                </div>

                <div className="min-w-0">
                  <SharedSearchableSelect
                    label="Production Plan"
                    required
                    value={selectedProductionPlan}
                    onChange={(val) => setSelectedProductionPlan(String(val))}
                    options={formProductionPlanOptions}
                    placeholder={
                      !selectedOperation
                        ? "Select an operation first"
                        : isLoadingFormProductionPlans
                          ? "Loading production plans..."
                          : "Select Production Plan"
                    }
                    disabled={!selectedOperation || isLoadingFormProductionPlans}
                    selectedTruncate="end"
                    showSelectedTitle
                    lightSelectedText
                    className="h-9"
                    listClassName="max-h-[220px]"
                  />
                </div>
              </div>

            {/* Eligible Batches Section with Multi-Select */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Eligible Batches</Label>
              {!selectedOperation || !selectedWorkCenter || !selectedWarehouse ? (
                <div className="text-center py-5 text-sm text-muted-foreground border rounded-md">
                  Please select Work Center, Operation, and Warehouse to view eligible batches
                </div>
              ) : isLoadingEligibleBatches ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground border rounded-md">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Loading...</p>
                </div>
              ) : eligibleBatches.length === 0 ? (
                <div className="text-center py-5 text-sm text-muted-foreground border rounded-md">
                  No eligible batches for this operation
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Batch Code</TableHead>
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
                        <TableHead className="text-primary font-bold">Batch Code</TableHead>
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
                          item.itemTypeCode === "FG"
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
                                        void handleImportSerialNumbers(
                                          batch.id,
                                          batch.batchNo,
                                          item.itemCode,
                                          file,
                                          expectedQty
                                        );
                                      }
                                      // Reset value so the same file can be selected again
                                      e.target.value = "";
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
                                  className={cn(
                                    "h-8 shadow-sm",
                                    importedCount === 0
                                      ? "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:opacity-100!"
                                      : "bg-blue-600 text-white hover:bg-blue-600/90 border-blue-600"
                                  )}
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
                <div className="text-center py-5 text-sm text-muted-foreground border rounded-md">
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
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/20 p-4 sm:p-5">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmittingCreate}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={isSubmittingCreate}
              disabled={isPrimaryButtonDisabledWithFG}
              className={
                isPrimaryButtonDisabledWithFG
                  ? "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:opacity-100!"
                  : "bg-blue-600 text-white hover:bg-blue-600/90 border-blue-600"
              }
            >
              Issue To WH
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
