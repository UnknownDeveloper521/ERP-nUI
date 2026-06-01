import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
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
    DialogFooter,
    DialogHeader,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import {
  OperationRelease,
  ProducedItem,
  aggregateProducedItems,
  parseBatchWiseOutputs,
} from "@/lib/releaseSharedData";
import { commonApi, inventoryApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { isMaterialReleaseStatusEntityName } from "@/services/loadCommonData";
import { useAuth } from "@/lib/store";
import { useHasPermission } from "@/hooks/usePermissions";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";
import { getBomMockSkusForItem } from "@/lib/bomSkuMockData";

/** Green styling for successful actions; keep errors as destructive. */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date from YYYY-MM-DD to DD-MM-YYYY
 */
const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

const formatWhReceiveItemSkuLabel = (item: {
    skuCode?: string;
    skuName?: string;
    itemCode?: string;
}): string => {
    if (item.skuCode) {
        return item.skuName ? `${item.skuCode} — ${item.skuName}` : item.skuCode;
    }
    if (item.skuName) return item.skuName;
    const mock = getBomMockSkusForItem(item.itemCode)[0];
    if (mock) return mock.name ? `${mock.code} — ${mock.name}` : mock.code;
    return "—";
};

function mapWhReceiveProducedItem(r: Record<string, unknown>, index: number): ProducedItem {
    return {
        id: Number(r.item_id ?? r.id ?? index + 1),
        itemCode: String(r.item_code ?? r.itemCode ?? ""),
        itemName: String(r.item_name ?? r.itemName ?? ""),
        uom: String(r.uom_name ?? r.uom ?? ""),
        qtyProduced: Number(
            r.total_qty ?? r.produced_qty ?? r.qty_produced ?? r.qtyProduced ?? r.qty ?? 0
        ),
        skuCode: String(r.sku_code ?? r.skuCode ?? ""),
        skuName: String(r.sku_name ?? r.skuName ?? ""),
        itemTypeCode: String(r.item_type_code ?? r.itemTypeCode ?? ""),
    };
}

function mapWhReceiveListRecord(r: Record<string, any>): OperationRelease {
  const st = (r.status_name ?? r.status ?? "Issued to Warehouse") as string;
  return {
    id: Number(r.release_id ?? r.material_release_id ?? r.id),
    releaseNo: String(r.release_code ?? r.release_no ?? r.releaseCode ?? ""),
    releaseDate: String(r.release_date ?? r.releaseDate ?? "").slice(0, 10),
    operation: r.operation_name ?? r.operation ?? "",
    workCenter: r.work_center_name ?? r.workCenter ?? "",
    warehouse: r.warehouse_name ?? r.warehouse ?? "",
    releasedBy: r.released_by_name ?? r.released_by_user_name ?? r.released_by ?? "—",
    status:
      (r.status_code ?? r.status_type_code) === "RECEIVED_BY_WAREHOUSE" || st === "Received By Warehouse" || (typeof st === "string" && st.toLowerCase().includes("received"))
        ? "Received By Warehouse"
        : "Issued to Warehouse",
    batchIds: (Array.isArray(r.batch_ids) ? r.batch_ids : Array.isArray(r.batch_nos) ? r.batch_nos : []) as string[],
    items: []
  };
}

/** Map GET /inventory/whreceive/:id body to OperationRelease (same shapes as material release detail). */
function mapWhReceiveDetailPayload(d: Record<string, any>): OperationRelease {
  const st = (
    d.status_name ??
    d.statusName ??
    d.status?.status_name ??
    d.status?.name ??
    (typeof d.status === "string" ? d.status : null) ??
    "Issued to Warehouse"
  ) as string;
  const toBatchIdStrings = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((b) => {
        if (b != null && typeof b === "object") {
          return String(
            (b as any).batch_no ?? (b as any).batch_code ?? (b as any).code ?? (b as any).id ?? ""
          );
        }
        return String(b);
      })
      .filter(Boolean);
  };
  const rawItems =
    d.items ?? d.produced_items ?? d.output_items ?? d.material_release_items ?? d.production_items ?? [];
  let items: ProducedItem[] = Array.isArray(rawItems)
    ? rawItems.map((r: any, i: number) => mapWhReceiveProducedItem(r, i))
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
          ? bItems.map((r: any, i: number) => mapWhReceiveProducedItem(r, i))
          : []
      };
    });
  } else if (bwo.batchDetails.length > 0) {
    batchDetails = bwo.batchDetails;
  }
  return {
    id: Number(d.release_id ?? d.material_release_id ?? d.id ?? 0),
    releaseNo: String(d.release_code ?? d.release_no ?? d.releaseCode ?? ""),
    releaseDate: String(d.release_date ?? d.releaseDate ?? "").slice(0, 10),
    operation: String(d.operation_name ?? d.operation ?? ""),
    workCenter: String(d.work_center_name ?? d.work_center ?? d.workCenter ?? ""),
    warehouse: String(d.warehouse_name ?? d.warehouse ?? ""),
    releasedBy: String(
      d.released_by_name ?? d.released_by_user_name ?? d.released_by ?? d.created_by_name ?? ""
    ) || "—",
    status:
      (d.status_code ?? d.status_type_code) === "RECEIVED_BY_WAREHOUSE" || st === "Received By Warehouse" || (typeof st === "string" && st.toLowerCase().includes("received"))
        ? "Received By Warehouse"
        : "Issued to Warehouse",
    batchIds,
    items,
    qcVerifiedBy: String(d.qc_verified_by_name ?? d.qc_verified_by_user_name ?? d.qc_verified_by ?? d.qcVerifiedBy ?? "") || "N/A",
    qcVerifiedOn: d.qc_verified_on ?? d.qcVerifiedOn,
    ...(batchDetails && batchDetails.length > 0 ? { batchDetails } : {})
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WHReceive() {
    const { canEdit, canView } = useHasPermission();
    const permissionModule = "INVENTORY/MATERIALS/WH_RECEIVE";
    const canViewWHReceive = canView(permissionModule);

    const { toast } = useToast();
    const { user } = useAuth();
    const entityValues = useCommonStore((s) => s.entityValues);
    const materialReleaseStatusEntities = useMemo(
        () =>
            (entityValues || []).filter((r: any) =>
                isMaterialReleaseStatusEntityName(
                    r.entity_type_name,
                    r.entity_type_code,
                    r.entity_type_id
                )
            ),
        [entityValues]
    );

    const [whReceives, setWhReceives] = useState<OperationRelease[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isListLoading, setIsListLoading] = useState(true);
    const [filterWorkCenters, setFilterWorkCenters] = useState<
        { work_center_id: number; work_center_name: string }[]
    >([]);
    const [filterWarehouses, setFilterWarehouses] = useState<{ id: number; name: string }[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [warehouseFilter, setWarehouseFilter] = useState("all");
    const [workCenterFilter, setWorkCenterFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedWHReceive, setSelectedWHReceive] = useState<OperationRelease | null>(null);
    const [isViewDetailLoading, setIsViewDetailLoading] = useState(false);
    const [openingViewId, setOpeningViewId] = useState<number | null>(null);
    const [isMarkReceivedLoading, setIsMarkReceivedLoading] = useState(false);
    const appliedWorkCenterFilterDefault = useRef(false);
    const appliedWarehouseFilterDefault = useRef(false);
    const appliedStatusFilterDefault = useRef(false);
    const [areListFiltersReady, setAreListFiltersReady] = useState(() => {
        const wc = getAssignedIds("workcenter");
        const wh = getAssignedIds("warehouse");
        return wc.length === 0 && wh.length === 0;
    });

    const assignedWorkcenterIds = getAssignedIds("workcenter");
    const assignedWarehouseIds = getAssignedIds("warehouse");
    const assignedWorkcenterKey = assignedWorkcenterIds.join(",");
    const assignedWarehouseKey = assignedWarehouseIds.join(",");

    const orderedFilterWorkCenters = useMemo(
        () =>
            prioritizeByAssigned(filterWorkCenters, assignedWorkcenterIds, (wc) => wc.work_center_id),
        [filterWorkCenters, assignedWorkcenterKey]
    );

    const orderedFilterWarehouses = useMemo(
        () => prioritizeByAssigned(filterWarehouses, assignedWarehouseIds, (wh) => wh.id),
        [filterWarehouses, assignedWarehouseKey]
    );

    const isActionBusy =
        isListLoading || openingViewId !== null || isViewDetailLoading || isMarkReceivedLoading;

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
            { label: "Received By Warehouse", value: "Received by Warehouse" }
        ];
    }, [materialReleaseStatusEntities]);

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

    useEffect(() => {
        let c = false;
        (async () => {
            try {
                const [wcRes, whRes] = await Promise.all([
                    commonApi.getWorkCenters(),
                    commonApi.getWarehouses()
                ]);
                if (c) return;
                if (wcRes.isSuccessful && Array.isArray(wcRes.data?.records)) {
                    const workCenterRecords = wcRes.data.records
                        .map((r: any) => ({
                            work_center_id: Number(r.id ?? r.work_center_id),
                            work_center_name: String(
                                r.work_center_name ?? r.name ?? r.value_name ?? ""
                            ).trim()
                        }))
                        .filter(
                            (r: { work_center_id: number; work_center_name: string }) =>
                                r.work_center_name && Number.isFinite(r.work_center_id)
                        );
                    setFilterWorkCenters(workCenterRecords);

                    if (
                        !appliedWorkCenterFilterDefault.current &&
                        assignedWorkcenterIds.length > 0 &&
                        workCenterRecords.length > 0
                    ) {
                        const ordered = prioritizeByAssigned<{ work_center_id: number; work_center_name: string }>(
                            workCenterRecords,
                            assignedWorkcenterIds,
                            (wc) => wc.work_center_id
                        );
                        const firstAssigned = getFirstAssignedMatch(
                            assignedWorkcenterIds,
                            ordered.map((wc) => wc.work_center_id)
                        );
                        if (firstAssigned) {
                            setWorkCenterFilter(firstAssigned);
                            appliedWorkCenterFilterDefault.current = true;
                        }
                    }
                } else {
                    setFilterWorkCenters([]);
                }
                if (whRes.isSuccessful && Array.isArray(whRes.data?.records)) {
                    const warehouseRecords = whRes.data.records
                        .map((r: any) => ({
                            id: Number(r.id ?? r.warehouse_id),
                            name: String(r.warehouse_name ?? r.name ?? "").trim()
                        }))
                        .filter((r: { id: number; name: string }) => r.name && Number.isFinite(r.id));
                    setFilterWarehouses(warehouseRecords);

                    if (
                        !appliedWarehouseFilterDefault.current &&
                        assignedWarehouseIds.length > 0 &&
                        warehouseRecords.length > 0
                    ) {
                        const ordered = prioritizeByAssigned<{ id: number; name: string }>(
                            warehouseRecords,
                            assignedWarehouseIds,
                            (wh) => wh.id
                        );
                        const firstAssigned = getFirstAssignedMatch(
                            assignedWarehouseIds,
                            ordered.map((wh) => wh.id)
                        );
                        if (firstAssigned) {
                            setWarehouseFilter(firstAssigned);
                            appliedWarehouseFilterDefault.current = true;
                        }
                    }
                } else {
                    setFilterWarehouses([]);
                }
            } catch {
                if (!c) {
                    setFilterWorkCenters([]);
                    setFilterWarehouses([]);
                }
            } finally {
                if (!c) setAreListFiltersReady(true);
            }
        })();
        return () => {
            c = true;
        };
    }, []);

    const fetchWHReceiveList = useCallback(async () => {
        if (!canViewWHReceive) return;
        if (!areListFiltersReady) return;
        setIsListLoading(true);
        const wcId =
            workCenterFilter === "all"
                ? undefined
                : (() => {
                      const n = Number(workCenterFilter);
                      return Number.isFinite(n) ? n : undefined;
                  })();
        const whId =
            warehouseFilter === "all"
                ? undefined
                : (() => {
                      const n = Number(warehouseFilter);
                      return Number.isFinite(n) ? n : undefined;
                  })();
        const statusId =
            statusFilter === "" || statusFilter === "all"
                ? undefined
                : Number(statusFilter);
        try {
            const res = await inventoryApi.getWHReceiveList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm?.trim() || undefined,
                work_center_id: wcId,
                warehouse_id: whId,
                status_id: statusId != null && !Number.isNaN(statusId) && Number.isFinite(statusId) ? statusId : undefined
            });
            if (res.isSuccessful && res.data) {
                setWhReceives((res.data.records || []).map((r) => mapWhReceiveListRecord(r as Record<string, any>)));
                setTotalRecords(res.data.pagination?.totalRecords ?? 0);
            } else {
                setWhReceives([]);
                setTotalRecords(0);
                toast({
                    title: "Error",
                    description: (res as any).message || "Failed to load WH receive list",
                    variant: "destructive"
                });
            }
        } catch {
            setWhReceives([]);
            setTotalRecords(0);
            toast({ title: "Error", description: "Failed to load WH receive list", variant: "destructive" });
        } finally {
            setIsListLoading(false);
        }
    }, [
        canViewWHReceive,
        currentPage,
        itemsPerPage,
        debouncedSearchTerm,
        workCenterFilter,
        warehouseFilter,
        statusFilter,
        areListFiltersReady,
        toast,
    ]);

    useEffect(() => {
        if (statusFilter === "") return; // Wait for default status
        void fetchWHReceiveList();
    }, [fetchWHReceiveList, statusFilter]);

    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 0;

    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // Handlers
    const handleView = async (whr: OperationRelease) => {
        if (isActionBusy) return;
        if (whr.id == null || !Number.isFinite(whr.id)) {
            toast({ title: "Error", description: "Invalid record.", variant: "destructive" });
            return;
        }
        setOpeningViewId(whr.id);
        setSelectedWHReceive(null);
        setIsViewDetailLoading(true);
        setIsViewModalOpen(true);
        try {
            const res = await inventoryApi.getWHReceiveById(whr.id);
            if (res.isSuccessful) {
                const raw = (res as any).data;
                const payload =
                    raw && typeof raw === "object" && (raw as any).data && typeof (raw as any).data === "object"
                        ? (raw as any).data
                        : raw;
                if (payload && typeof payload === "object" && !Array.isArray(payload)) {
                    const mappedDetail = mapWhReceiveDetailPayload(payload as Record<string, any>);
                    setSelectedWHReceive({
                        ...mappedDetail,
                        id: whr.id, // Ensure ID is preserved for "Mark as Received" actions
                        // If detail status is default "Issued to Warehouse" but list said "Received", prefer list
                        status: (mappedDetail.status === "Issued to Warehouse" && whr.status === "Received By Warehouse")
                            ? "Received By Warehouse"
                            : mappedDetail.status
                    });
                } else {
                    setSelectedWHReceive({ ...whr });
                    toast({
                        title: "Notice",
                        description: "No detail payload; showing list row.",
                        variant: "default"
                    });
                }
            } else {
                setSelectedWHReceive({ ...whr });
                toast({
                    title: "Error",
                    description: (res as any).message || "Failed to load details. Showing list row.",
                    variant: "destructive"
                });
            }
        } catch {
            setSelectedWHReceive({ ...whr });
            toast({
                title: "Error",
                description: "Failed to load details. Showing list row.",
                variant: "destructive"
            });
        } finally {
            setIsViewDetailLoading(false);
            setOpeningViewId(null);
        }
    };

    const handleItemCheckChange = (itemId: number, checked: boolean) => {
        // Not implemented in the new item-wise grouping logic but kept for type compatibility
    };

    const handleItemQtyChange = (itemId: number, qty: number) => {
        // Not implemented in the new item-wise grouping logic but kept for type compatibility
    };

    const resolveCompanyId = (): number | undefined => {
        const toValidCompanyId = (value: unknown): number | undefined => {
            const n = Number(value);
            return Number.isFinite(n) && n > 0 ? n : undefined;
        };

        // 1) currentUser from auth context
        const fromUser =
            toValidCompanyId((user as any)?.companyId) ??
            toValidCompanyId((user as any)?.company_id);
        if (fromUser) return fromUser;

        // 2) app state snapshot from localStorage (currentUser)
        try {
            const rawCurrentUser = localStorage.getItem("currentUser");
            if (rawCurrentUser) {
                const parsedCurrentUser = JSON.parse(rawCurrentUser);
                const fromCurrentUser =
                    toValidCompanyId(parsedCurrentUser?.companyId) ??
                    toValidCompanyId(parsedCurrentUser?.company_id) ??
                    toValidCompanyId(parsedCurrentUser?.company?.id) ??
                    toValidCompanyId(parsedCurrentUser?.company?.company_id);
                if (fromCurrentUser) return fromCurrentUser;
            }
        } catch {
            // ignore parse errors and continue fallback chain
        }

        // 3) raw auth payload from localStorage (auth_user)
        try {
            const raw = localStorage.getItem("auth_user");
            if (raw) {
                const parsed = JSON.parse(raw);
                const fromAuthUser =
                    toValidCompanyId(parsed?.companyId) ??
                    toValidCompanyId(parsed?.company_id) ??
                    toValidCompanyId(parsed?.user?.companyId) ??
                    toValidCompanyId(parsed?.user?.company_id) ??
                    toValidCompanyId(parsed?.company?.id) ??
                    toValidCompanyId(parsed?.company?.company_id);
                if (fromAuthUser) return fromAuthUser;
            }
        } catch {
            // ignore parse errors and continue fallback chain
        }

        // 4) jwt payload company_id
        try {
            const token = localStorage.getItem("auth_token");
            if (token) {
                const parts = token.split(".");
                if (parts.length >= 2) {
                    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
                    while (base64.length % 4 !== 0) base64 += "=";
                    const payload = JSON.parse(atob(base64));
                    const fromToken =
                        toValidCompanyId(payload?.company_id) ??
                        toValidCompanyId(payload?.companyId) ??
                        toValidCompanyId(payload?.user?.company_id) ??
                        toValidCompanyId(payload?.user?.companyId);
                    if (fromToken) return fromToken;
                }
            }
        } catch {
            // ignore parse errors
        }

        return undefined;
    };

    /**
     * Mark as Received — PATCH /inventory/whreceive/receiveItems/:id
     */
    const handleMarkAsReceived = async () => {
        if (!selectedWHReceive) return;
        if (isMarkReceivedLoading) return;
        const id = selectedWHReceive.id;
        if (id == null || !Number.isFinite(id)) {
            toast({ title: "Error", description: "Invalid record id.", variant: "destructive" });
            return;
        }
        setIsMarkReceivedLoading(true);
        try {
            const companyId = resolveCompanyId();
            if (!companyId) {
                toast({
                    title: "Session Error",
                    description: "Company context missing. Please log out and log in again.",
                    variant: "destructive"
                });
                return;
            }

            const res = await inventoryApi.receiveWHReceiveItems(id, { company_id: companyId });
            if (res.isSuccessful) {
                toast({
                    ...crudSuccessToast,
                    title: "Success",
                    description: (res as any).message || "Material received in warehouse.",
                    duration: 15000,
                });
                setIsViewModalOpen(false);
                setSelectedWHReceive(null);
                setIsViewDetailLoading(false);
                void fetchWHReceiveList();
            } else {
                toast({
                    title: "Error",
                    description: (res as any).message || "Failed to mark as received.",
                    variant: "destructive"
                });
            }
        } catch (e) {
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Failed to mark as received.",
                variant: "destructive"
            });
        } finally {
            setIsMarkReceivedLoading(false);
        }
    };

    // ============================================================================
    // RENDER: LISTING VIEW
    // ============================================================================

    return (
        <div className="flex flex-col gap-6">
            {/* Filter Section */}
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: (v) => {
                        setSearchTerm(v);
                        setCurrentPage(1);
                    },
                    placeholder: "Search by release code"
                }}
                filters={[
                    {
                        type: "select",
                        label: "Work Center",
                        value: workCenterFilter,
                        options: [
                            { label: "All Work Centers", value: "all" },
                            ...orderedFilterWorkCenters.map((wc) => ({
                                value: String(wc.work_center_id),
                                label: wc.work_center_name
                            }))
                        ],
                        onChange: (v) => {
                            setWorkCenterFilter(v);
                            setCurrentPage(1);
                        },
                        searchable: true
                    },
                    {
                        type: "select",
                        label: "Warehouse",
                        value: warehouseFilter,
                        options: [
                            { label: "All Warehouses", value: "all" },
                            ...orderedFilterWarehouses.map((w) => ({ value: String(w.id), label: w.name }))
                        ],
                        onChange: (v) => {
                            setWarehouseFilter(v);
                            setCurrentPage(1);
                        },
                        searchable: true
                    },
                    {
                        type: "select",
                        label: "Status",
                        value: statusFilter,
                        options: statusSelectOptions,
                        onChange: (v) => {
                            setStatusFilter(v);
                            setCurrentPage(1);
                        },
                        searchable: true
                    }
                ]}
            />

            {/* Listing Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">RELEASE CODE</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">RELEASE DATE</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">OPERATION</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">WORK CENTER</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">WAREHOUSE</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">STATUS</TableHead>
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
                                ) : whReceives.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No warehouse receipts found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    whReceives.map((whr) => (
                                        <TableRow key={whr.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4 font-medium text-primary">{whr.releaseNo}</TableCell>
                                            <TableCell>{formatDate(whr.releaseDate)}</TableCell>
                                            <TableCell>{whr.operation}</TableCell>
                                            <TableCell>{whr.workCenter}</TableCell>
                                            <TableCell>{whr.warehouse}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium whitespace-nowrap w-fit px-2.5 py-0.5",
                                                        whr.status === "Issued to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                                        whr.status === "Received By Warehouse" && "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {whr.status}
                                                </Badge>
                                            </TableCell>
                                             <TableCell className="text-center">
                                                <div className={cn(isActionBusy && "pointer-events-none opacity-50")}>
                                                    <TableActionButtons
                                                        onView={canEdit(permissionModule) ? () => { void handleView(whr); } : undefined}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {/* Pagination - using standardized DataTablePagination component */}
                    {totalRecords > 0 && !isListLoading && (
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

            {/* View Modal */}
            <Dialog
                open={isViewModalOpen}
                onOpenChange={(open) => {
                    setIsViewModalOpen(open);
                    if (!open) {
                        setSelectedWHReceive(null);
                        setIsViewDetailLoading(false);
                        setIsMarkReceivedLoading(false);
                    }
                }}
            >
                <DialogContent
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 border-b p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="text-lg font-bold sm:text-xl">
                            WH Receive: {selectedWHReceive?.releaseNo ?? "—"}
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
                            Review release details and confirm receipt into warehouse.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        {isViewDetailLoading && (
                            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 sm:min-h-[320px]">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        )}

                        {!isViewDetailLoading && selectedWHReceive && (
                            <div className="space-y-5">
                                {/* Receipt Information */}
                                <div>
                                    <h3 className="border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                                        Receipt Information
                                    </h3>
                                    <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5 lg:grid-cols-3">
                                        <div className="min-w-0 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Release Code</Label>
                                            <p className="truncate font-mono text-sm font-semibold" title={selectedWHReceive.releaseNo}>
                                                {selectedWHReceive.releaseNo}
                                            </p>
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Release Date</Label>
                                            <p className="text-sm font-semibold">{formatDate(selectedWHReceive.releaseDate)}</p>
                                        </div>
                                        <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operation</Label>
                                            <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={selectedWHReceive.operation}>
                                                {selectedWHReceive.operation}
                                            </p>
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Work Center</Label>
                                            <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={selectedWHReceive.workCenter}>
                                                {selectedWHReceive.workCenter}
                                            </p>
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Warehouse</Label>
                                            <p className="whitespace-normal wrap-break-word text-sm font-semibold leading-snug" title={selectedWHReceive.warehouse}>
                                                {selectedWHReceive.warehouse}
                                            </p>
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Released By</Label>
                                            <p className="truncate text-sm font-semibold" title={selectedWHReceive.releasedBy}>
                                                {selectedWHReceive.releasedBy}
                                            </p>
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">QC Verified By</Label>
                                            <p className="truncate text-sm font-semibold" title={selectedWHReceive.qcVerifiedBy || "N/A"}>
                                                {selectedWHReceive.qcVerifiedBy || "N/A"}
                                            </p>
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">QC Verified On</Label>
                                            <p className="text-sm font-semibold">
                                                {selectedWHReceive.qcVerifiedOn ? formatDate(selectedWHReceive.qcVerifiedOn) : "N/A"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div>
                                    <h3 className="border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                                        Items Received
                                    </h3>

                                    {(() => {
                                        if (!selectedWHReceive.items || selectedWHReceive.items.length === 0) {
                                            return (
                                                <div className="mt-3 text-center py-6 text-sm text-muted-foreground border rounded-md">
                                                    No items available
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="mt-3 overflow-hidden rounded-md border bg-white shadow-sm">
                                                <div className={cn(
                                                    "overflow-x-auto",
                                                    selectedWHReceive.items.length > 6 && "max-h-[min(45vh,360px)] overflow-y-auto custom-scrollbar"
                                                )}>
                                                <Table className="w-full min-w-[720px] table-fixed">
                                                    <colgroup>
                                                        <col className="w-[32%]" />
                                                        <col className="w-[34%]" />
                                                        <col className="w-[14%]" />
                                                        <col className="w-[20%]" />
                                                    </colgroup>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                            <TableHead className="py-2.5 pl-4 pr-2 text-[10px] font-bold uppercase tracking-wider">Item</TableHead>
                                                            <TableHead className="py-2.5 pl-0 pr-2 text-left text-[10px] font-bold uppercase tracking-wider">SKU</TableHead>
                                                            <TableHead className="py-2.5 text-[10px] font-bold uppercase tracking-wider">UOM</TableHead>
                                                            <TableHead className="py-2.5 pr-4 text-right text-[10px] font-bold uppercase tracking-wider">Received Qty</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {selectedWHReceive.items.map((item, index) => (
                                                            <TableRow key={index} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                                <TableCell className="max-w-0 py-3 pl-4 pr-2 align-top">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-xs text-primary truncate" title={item.itemCode}>{item.itemCode}</span>
                                                                        <span className="text-[10px] text-slate-500 font-medium whitespace-normal wrap-break-word leading-snug" title={item.itemName}>
                                                                            {item.itemName}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="max-w-0 py-3 pl-0 pr-2 align-top text-left text-xs text-muted-foreground">
                                                                    <span
                                                                        className="line-clamp-2"
                                                                        title={formatWhReceiveItemSkuLabel(item)}
                                                                    >
                                                                        {formatWhReceiveItemSkuLabel(item)}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="whitespace-nowrap text-xs">{item.uom}</TableCell>
                                                                <TableCell className="whitespace-nowrap text-right font-bold text-xs text-primary pr-4 tabular-nums">{item.qtyProduced}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Summary */}
                                    {/* ✅ CHANGED: Removed "Total Op Qty" from summary */}
                                    <div className="mt-4 flex justify-end">
                                        <div className="min-w-[240px] space-y-2 rounded-lg border bg-muted/20 p-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Items:</span>
                                                <span className="font-semibold">{selectedWHReceive.items.length}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Received Qty:</span>
                                                <span className="font-semibold text-primary tabular-nums">
                                                    {selectedWHReceive.items.reduce((sum, item) => sum + item.qtyProduced, 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <DialogFooter className="shrink-0 border-t bg-muted/20 p-4 sm:p-5">
                        <div className="flex justify-end gap-2 w-full">
                            <Button
                                variant="outline"
                                onClick={() => setIsViewModalOpen(false)}
                                disabled={isMarkReceivedLoading || isViewDetailLoading}
                            >
                                Close
                            </Button>
                            {(selectedWHReceive?.status === "Issued to Warehouse" && canEdit(permissionModule)) && (
                                <Button
                                    onClick={() => void handleMarkAsReceived()}
                                    loading={isMarkReceivedLoading}
                                    disabled={isMarkReceivedLoading || isViewDetailLoading}
                                >
                                    Mark as Received
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
