import { useState, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation, useRoute } from "wouter";
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
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
    Plus,
    Search,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Check,
    ChevronsUpDown,
    Calendar as CalendarIcon,
    ChevronDown,
    X,
    Play, Clock, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { parse, isValid, differenceInDays, isAfter, isBefore, startOfDay } from "date-fns";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";
import { productionApi, commonApi, operationsApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";
import {
    buildGsv7NestedBomTree,
    applyGsv7BomQuantityMap,
    getAllGsv7BomComponentRecords,
    isGsv7CatalogItemCode,
    loadGsv7BomQuantities,
    type Gsv7BomOperationTree,
    type Gsv7BomStructureLine,
    type Gsv7BomStructureOperation,
} from "@/lib/gsv7BomTreeBuilder";
import { getBomMockSkusForItem } from "@/lib/bomSkuMockData";
import { loadProcurementSkuRecords, type SkuRecord } from "@/pages/masters/ProcurementSkuTab";

import { 
    DailyFGPlan, 
    INITIAL_PLANS, 
    PlanStatus 
} from "@/lib/productionPlanSharedData";

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

const formatPlanOutputSkuLabel = (out: {
    itemCode?: string;
    skuCode?: string;
    skuName?: string;
}): string => {
    if (out.skuCode) {
        return out.skuName ? `${out.skuCode} — ${out.skuName}` : out.skuCode;
    }
    if (out.skuName) return out.skuName;
    const mock = getBomMockSkusForItem(out.itemCode)[0];
    if (mock) return mock.name ? `${mock.code} — ${mock.name}` : mock.code;
    return "—";
};

// ============================================================================
// PRODUCTION PLAN MANAGEMENT MODULE
// ============================================================================
// This module handles the creation and tracking of production plans.
// Key Features:
// - Date range planning (Start & End dates) with 30-day strict validation.
// - Status lifecycle: To Do -> In Progress -> Completed -> Overdue.
// - Real-time output tracking (Fulfilled vs Targeted quantity).
// - Integration: Plans created here are linkable in Material Requests.
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

const formatDate = (date: Date | string): string => {
    if (!date) return "";
    const d = typeof date === 'string' ? parseDateString(date) : date;
    if (!isValid(d)) return typeof date === 'string' ? date : "";
    return format(d, "dd-MM-yyyy");
};

const parseDateString = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // Try DD-MM-YYYY first
    let parsed = parse(dateStr, "dd-MM-yyyy", new Date());
    if (isValid(parsed)) return parsed;
    // Fallback to YYYY-MM-DD
    parsed = parse(dateStr, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
    return new Date(dateStr);
};

const resolveOperationCode = (
    opId: number | string,
    op: { code?: string } | undefined,
    records: any[]
): string => {
    const listOp = records.find((lo) => String(lo.id || lo.operation_id) === String(opId));
    return String(
        listOp?.operation_code ||
        listOp?.code ||
        op?.code ||
        ""
    ).trim();
};

const OPERATION_FLOW_MAPPING_STORAGE_KEY = "master-erp-operation-flow-mappings";

interface MappedFlowOperation {
    operation_id: number;
    operation_code: string;
    operation_name: string;
    sequence: number;
}

interface PlanStructureLine {
    item_id: number;
    item_code: string;
    item_name: string;
    type: string;
    uom: string;
    quantity: number | string;
}

interface PlanStructureOperation {
    id: number;
    code: string;
    name: string;
    sequence?: number;
    outputs: PlanStructureLine[];
    inputs: PlanStructureLine[];
}

interface PlanOperationTree {
    selectedItemCode: string;
    selectedItemName: string;
    mainOperation: PlanStructureOperation;
    childOperations: PlanStructureOperation[];
}

function loadAllOperationFlowMappings(): Record<string, MappedFlowOperation[]> {
    try {
        const raw = localStorage.getItem(OPERATION_FLOW_MAPPING_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

const extractOperationPayload = (res: any) => {
    const data = res?.data;
    if (Array.isArray(data?.records)) return data.records[0] || {};
    if (data?.record) return data.record;
    if (data?.data) return data.data;
    if (data?.operation) return data.operation;
    if (data?.result) return data.result;
    return data || {};
};

const extractOperationItems = (payload: any, kind: "inputs" | "outputs") => {
    const keys =
        kind === "inputs"
            ? ["inputs", "inputs_data", "input_items", "input_materials", "operation_inputs"]
            : ["outputs", "outputs_data", "output_items", "output_materials", "operation_outputs"];

    for (const key of keys) {
        const val = payload?.[key];
        if (Array.isArray(val)) return val;
    }

    const merged = payload?.operation_items ?? payload?.items ?? payload?.materials;
    if (Array.isArray(merged)) {
        return merged.filter((row: any) => {
            const direction = String(
                row?.direction ?? row?.item_direction ?? row?.kind ?? row?.type ?? row?.entry_type ?? "",
            ).toLowerCase();
            const ioFlag = row?.is_input;
            if (kind === "inputs") return direction.includes("input") || ioFlag === true || ioFlag === 1;
            return direction.includes("output") || ioFlag === false || ioFlag === 0;
        });
    }
    return [];
};

const normalizePlanItemType = (raw?: string): string => {
    const code = String(raw || "").toUpperCase();
    if (code === "RM" || code.includes("RAW")) return "RM";
    if (code === "SFG" || code.includes("SEMI")) return "SFG";
    if (code === "FG" || (code.includes("FINISHED") && !code.includes("SEMI"))) return "FG";
    if (code === "WASTE" || code.includes("WASTE")) return "Waste";
    return raw ? String(raw) : "RM";
};

const mapPlanOperationLine = (row: any, fallbackType: string): PlanStructureLine => ({
    item_id: Number(row.item_id ?? row.item?.id ?? 0),
    item_code: String(row.item_code ?? row.item?.code ?? row.material_code ?? "").trim(),
    item_name: String(row.item_name ?? row.item?.name ?? row.material_name ?? "Unknown").trim(),
    type: normalizePlanItemType(
        String(row.item_type ?? row.type ?? row.item_type_name ?? row.type_name ?? row.material_type ?? fallbackType),
    ),
    uom: String(row.uom ?? row.uom_name ?? row.item?.uom ?? row.item?.uom_name ?? "Nos").trim(),
    quantity: Number(row.quantity ?? 1) || 1,
});

const parsePlanOperationDetail = async (operationId: number) => {
    const res = await operationsApi.getOne(operationId);
    if (!res?.isSuccessful) return null;
    const payload = extractOperationPayload(res);
    const op = payload?.operation ?? payload;
    return {
        id: Number(op.id ?? operationId),
        code: String(op.code ?? "").trim(),
        name: String(op.name ?? "").trim(),
        inputs: extractOperationItems(payload, "inputs").map((r: any) => mapPlanOperationLine(r, "RM")),
        outputs: extractOperationItems(payload, "outputs").map((r: any) => mapPlanOperationLine(r, "SFG")),
    };
};

const operationOutputsItem = (outputs: PlanStructureLine[], itemId: number) =>
    outputs.some((o) => o.item_id === itemId);

async function findMainOperationIdForItem(
    outputItemId: number,
    listOperationIds: number[],
): Promise<number | null> {
    const flowParents = Object.keys(loadAllOperationFlowMappings())
        .map((k) => Number(k))
        .filter((id) => Number.isFinite(id) && id > 0);
    const candidates = [...new Set([...flowParents, ...listOperationIds])];
    const chunkSize = 6;

    for (let i = 0; i < candidates.length; i += chunkSize) {
        const chunk = candidates.slice(i, i + chunkSize);
        const results = await Promise.all(
            chunk.map(async (id) => {
                const detail = await parsePlanOperationDetail(id);
                if (!detail) return null;
                return operationOutputsItem(detail.outputs, outputItemId) ? detail.id : null;
            }),
        );
        const found = results.find((id) => id != null);
        if (found) return found;
    }
    return null;
}

async function buildPlanOperationTree(outputItemId: number, itemCode: string, itemName: string) {
    const listRes = await operationsApi.getAll({ page: 1, limit: 500 });
    if (!listRes?.isSuccessful) return null;

    const records = Array.isArray(listRes?.data?.records) ? listRes.data.records : [];
    const listOperationIds = records
        .map((row: any) => Number((row?.operation ?? row)?.id))
        .filter((id: number) => Number.isFinite(id) && id > 0);

    const mainOpId = await findMainOperationIdForItem(outputItemId, listOperationIds);
    if (!mainOpId) return null;

    const mainDetail = await parsePlanOperationDetail(mainOpId);
    if (!mainDetail) return null;

    const flowRows = loadAllOperationFlowMappings()[String(mainOpId)] ?? [];
    const childOperations: PlanStructureOperation[] = [];

    for (const flowRow of flowRows) {
        const child = await parsePlanOperationDetail(flowRow.operation_id);
        if (!child) continue;
        childOperations.push({
            id: child.id,
            code: child.code || flowRow.operation_code,
            name: child.name || flowRow.operation_name,
            sequence: flowRow.sequence,
            outputs: child.outputs,
            inputs: child.inputs,
        });
    }

    return {
        selectedItemCode: itemCode,
        selectedItemName: itemName,
        mainOperation: mainDetail,
        childOperations,
    } satisfies PlanOperationTree;
}

function findBomRecordByOutputItemId(records: any[], outputItemId: number) {
    return records.find((r) => Number(r?.output_component?.id) === Number(outputItemId));
}

function mapBomComponentInputToPlanLine(input: any): PlanStructureLine {
    return {
        item_id: Number(input.item_id),
        item_code: String(input.item_code ?? "").trim(),
        item_name: String(input.item_name ?? "Unknown").trim(),
        type: normalizePlanItemType(String(input.item_type ?? "RM")),
        uom: String(input.uom ?? input.uom_name ?? "Nos").trim(),
        quantity: Number(input.quantity ?? 1) || 1,
    };
}

function resolveOperationIdForOutputItem(itemId: number, operationList: any[]): number {
    for (const op of operationList) {
        const hasOutput = (op.outputs || []).some(
            (o: any) => Number(o.item_id) === Number(itemId),
        );
        if (hasOutput) return Number(op.id);
    }
    return 0;
}

async function buildPlanTreeForFinishedGood(
    fg: { id: number; code: string; name: string; uom: string; type: string },
    fallbackOperationId: number,
    bomRecord: any | null,
    operationList: any[],
): Promise<PlanOperationTree | null> {
    const opId =
        fallbackOperationId > 0
            ? fallbackOperationId
            : resolveOperationIdForOutputItem(fg.id, operationList);

    let tree = await buildPlanTreeWithFallback(fg.id, fg.code, fg.name, opId);

    const bomInputs = Array.isArray(bomRecord?.input_components)
        ? bomRecord.input_components
        : [];
    if (bomInputs.length === 0) return tree;

    const inputLines = bomInputs.map(mapBomComponentInputToPlanLine);
    const fgOutput: PlanStructureLine = {
        item_id: fg.id,
        item_code: fg.code,
        item_name: fg.name,
        type: fg.type || "FG",
        uom: fg.uom,
        quantity: 1,
    };

    if (tree) {
        const hasFgOutput = tree.mainOperation.outputs.some((o) => o.item_id === fg.id);
        return {
            ...tree,
            mainOperation: {
                ...tree.mainOperation,
                outputs: hasFgOutput ? tree.mainOperation.outputs : [fgOutput, ...tree.mainOperation.outputs],
                inputs: inputLines,
            },
        };
    }

    const mainOpId = opId > 0 ? opId : 0;
    let mainDetail = mainOpId > 0 ? await parsePlanOperationDetail(mainOpId) : null;
    const childOperations: PlanStructureOperation[] = [];

    if (mainOpId > 0) {
        const flowRows = loadAllOperationFlowMappings()[String(mainOpId)] ?? [];
        for (const flowRow of flowRows) {
            const child = await parsePlanOperationDetail(flowRow.operation_id);
            if (!child) continue;
            childOperations.push({
                id: child.id,
                code: child.code || flowRow.operation_code,
                name: child.name || flowRow.operation_name,
                sequence: flowRow.sequence,
                outputs: child.outputs,
                inputs: child.inputs,
            });
        }
    }

    if (!mainDetail && mainOpId > 0) {
        mainDetail = await parsePlanOperationDetail(mainOpId);
    }

    return {
        selectedItemCode: fg.code,
        selectedItemName: fg.name,
        mainOperation: {
            id: mainDetail?.id ?? mainOpId,
            code: mainDetail?.code ?? "—",
            name: mainDetail?.name ?? "Assembly",
            outputs: [fgOutput],
            inputs: inputLines,
        },
        childOperations,
    };
}

async function buildPlanTreeWithFallback(
    outputItemId: number,
    itemCode: string,
    itemName: string,
    fallbackOperationId: number,
): Promise<PlanOperationTree | null> {
    const fromBom = await buildPlanOperationTree(outputItemId, itemCode, itemName);
    if (fromBom) return fromBom;

    if (!Number.isFinite(fallbackOperationId) || fallbackOperationId <= 0) return null;

    const mainDetail = await parsePlanOperationDetail(fallbackOperationId);
    if (!mainDetail) return null;

    const flowRows = loadAllOperationFlowMappings()[String(fallbackOperationId)] ?? [];
    const childOperations: PlanStructureOperation[] = [];

    for (const flowRow of flowRows) {
        const child = await parsePlanOperationDetail(flowRow.operation_id);
        if (!child) continue;
        childOperations.push({
            id: child.id,
            code: child.code || flowRow.operation_code,
            name: child.name || flowRow.operation_name,
            sequence: flowRow.sequence,
            outputs: child.outputs,
            inputs: child.inputs,
        });
    }

    return {
        selectedItemCode: itemCode,
        selectedItemName: itemName,
        mainOperation: mainDetail,
        childOperations,
    };
}

function scalePlanTree(tree: PlanOperationTree, outputItemId: number, targetQty: number): PlanOperationTree {
    const mainOut =
        tree.mainOperation.outputs.find((o) => o.item_id === outputItemId) ?? tree.mainOperation.outputs[0];
    const baseQty = Number(mainOut?.quantity) || 1;
    const factor = targetQty / baseQty;

    const scale = (line: PlanStructureLine): PlanStructureLine => ({
        ...line,
        quantity: Math.round(Number(line.quantity) * factor * 1000) / 1000,
    });

    return {
        ...tree,
        mainOperation: {
            ...tree.mainOperation,
            outputs: tree.mainOperation.outputs.map((o) =>
                o.item_id === outputItemId ? { ...o, quantity: targetQty } : scale(o),
            ),
            inputs: tree.mainOperation.inputs.map(scale),
        },
        childOperations: tree.childOperations.map((child) => ({
            ...child,
            outputs: child.outputs.map(scale),
            inputs: child.inputs.map(scale),
        })),
    };
}

const formatPlanQty = (qty: number | string, uom: string) => {
    const n = Number(qty);
    const u = String(uom || "Nos").trim();
    if (!Number.isFinite(n)) return `0 ${u}`;
    const formatted = Number.isInteger(n)
        ? n.toLocaleString()
        : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return `${formatted} ${u}`;
};

const planTypeBadgeClass = (type: string) => {
    const t = type.toUpperCase();
    if (t === "FG") return "bg-blue-50 text-blue-700 border-blue-200";
    if (t === "SFG") return "bg-purple-50 text-purple-700 border-purple-200";
    if (t === "RM") return "bg-slate-50 text-slate-700 border-slate-200";
    if (t === "WASTE") return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-muted/50 text-muted-foreground border-border";
};

const isFinishedGoodType = (typeRaw: string) => {
    const t = String(typeRaw || "").toUpperCase();
    return t === "FG" || (t.includes("FINISHED") && !t.includes("SEMI"));
};

/** UI-only sample tree when live operation has no inputs / mini-ops configured yet. */
function buildDemoPlanTree(
    fg: { id: number; code: string; name: string; uom: string; type: string },
    mainOp?: { id: number; code: string; name: string },
): PlanOperationTree {
    return {
        selectedItemCode: fg.code,
        selectedItemName: fg.name,
        mainOperation: {
            id: mainOp?.id ?? 0,
            code: mainOp?.code ?? "OPR-DEMO",
            name: mainOp?.name ?? "Main assembly",
            outputs: [
                {
                    item_id: fg.id,
                    item_code: fg.code,
                    item_name: fg.name,
                    type: fg.type || "FG",
                    uom: fg.uom,
                    quantity: 1,
                },
            ],
            inputs: [
                {
                    item_id: -101,
                    item_code: "SFG-PLATE",
                    item_name: "Coated Plate",
                    type: "SFG",
                    uom: "Nos",
                    quantity: 2,
                },
                {
                    item_id: -102,
                    item_code: "SFG-TRML",
                    item_name: "Terminal",
                    type: "SFG",
                    uom: "Nos",
                    quantity: 2,
                },
                {
                    item_id: -103,
                    item_code: "RM-BOX",
                    item_name: "Outer box 345-165-110mm",
                    type: "RM",
                    uom: "Nos",
                    quantity: 1,
                },
            ],
        },
        childOperations: [
            {
                id: -201,
                code: "OP-001",
                name: "Plate Preparation",
                sequence: 1,
                outputs: [
                    {
                        item_id: -111,
                        item_code: "SFG-PLATE",
                        item_name: "Coated Plate",
                        type: "SFG",
                        uom: "Nos",
                        quantity: 1,
                    },
                ],
                inputs: [
                    {
                        item_id: -112,
                        item_code: "RM-LEAD",
                        item_name: "Lead alloy",
                        type: "RM",
                        uom: "Kg",
                        quantity: 0.9,
                    },
                    {
                        item_id: -113,
                        item_code: "RM-ACTIVE",
                        item_name: "Active material",
                        type: "RM",
                        uom: "Kg",
                        quantity: 1.6,
                    },
                ],
            },
            {
                id: -202,
                code: "OP-TRML",
                name: "Terminal Creation",
                sequence: 2,
                outputs: [
                    {
                        item_id: -121,
                        item_code: "SFG-TRML",
                        item_name: "Terminal",
                        type: "SFG",
                        uom: "Nos",
                        quantity: 1,
                    },
                ],
                inputs: [
                    {
                        item_id: -122,
                        item_code: "RM-PB",
                        item_name: "Purified lead",
                        type: "RM",
                        uom: "Kg",
                        quantity: 0.4,
                    },
                ],
            },
        ],
    };
}

function enrichPlanTreeWithDemoIfThin(
    tree: PlanOperationTree | null,
    fg: { id: number; code: string; name: string; uom: string; type: string },
    hasBomComponents: boolean,
): { tree: PlanOperationTree | null; isDemo: boolean } {
    if (hasBomComponents) {
        return { tree, isDemo: false };
    }
    if (!tree) {
        return { tree: buildDemoPlanTree(fg), isDemo: true };
    }
    if (tree.mainOperation.inputs.length > 0 || tree.childOperations.length > 0) {
        return { tree, isDemo: false };
    }
    return {
        tree: buildDemoPlanTree(fg, {
            id: tree.mainOperation.id,
            code: tree.mainOperation.code,
            name: tree.mainOperation.name,
        }),
        isDemo: true,
    };
}

function mapGsv7PlanLine(line: Gsv7BomStructureLine): PlanStructureLine {
    const producedByLabel = line.producedBy ? ` (made by ${line.producedBy.code})` : "";
    return {
        item_id: line.item_id,
        item_code: line.item_code,
        item_name: `${line.item_name}${producedByLabel}`,
        type: line.type,
        uom: line.uom,
        quantity: line.quantity,
    };
}

function mapGsv7PlanOperation(op: Gsv7BomStructureOperation): PlanStructureOperation {
    return {
        id: op.id,
        code: op.code,
        name: op.name,
        sequence: op.sequence,
        outputs: op.outputs.map(mapGsv7PlanLine),
        inputs: op.inputs.map(mapGsv7PlanLine),
    };
}

function gsv7BomTreeToPlanTree(tree: Gsv7BomOperationTree): PlanOperationTree {
    return {
        selectedItemCode: tree.selectedItemCode,
        selectedItemName: tree.selectedItemName,
        mainOperation: mapGsv7PlanOperation(tree.mainOperation),
        childOperations: tree.childOperations.map(mapGsv7PlanOperation),
    };
}

function buildGsv7PlanTreeFromBom(itemCode: string, bomRecord: any | null): PlanOperationTree | null {
    let gsv7Tree = buildGsv7NestedBomTree(itemCode, 1);
    if (!gsv7Tree) return null;

    const savedQty = loadGsv7BomQuantities(itemCode);
    gsv7Tree = applyGsv7BomQuantityMap(gsv7Tree, savedQty);

    if (Object.keys(savedQty).length === 0 && Array.isArray(bomRecord?.input_components)) {
        const bomQtyMap: Record<string, number> = {};
        bomRecord.input_components.forEach((inp: { item_id: number; quantity?: number }) => {
            bomQtyMap[String(inp.item_id)] = Number(inp.quantity) || 1;
        });
        gsv7Tree = applyGsv7BomQuantityMap(gsv7Tree, bomQtyMap);
    }

    return gsv7BomTreeToPlanTree(gsv7Tree);
}

function PlanMainOperationCard({
    operation,
    highlightedItemId,
    highlightedType,
}: {
    operation: PlanStructureOperation;
    highlightedItemId?: number;
    highlightedType?: string;
}) {
    return (
        <div className="rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                <p className="text-sm font-bold text-foreground">
                    <span className="font-mono">{operation.code}</span>
                    <span className="text-muted-foreground font-normal"> • </span>
                    {operation.name}
                </p>
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] shrink-0">
                    Main Operation
                </Badge>
            </div>
            <div className="space-y-4 p-4">
                {operation.outputs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Output
                        </p>
                        <div className="space-y-2">
                            {operation.outputs.map((line) => (
                                <PlanOperationItemRow
                                    key={`main-out-${line.item_id}`}
                                    line={line}
                                    highlighted={line.item_id === highlightedItemId}
                                    typeOverride={
                                        line.item_id === highlightedItemId ? highlightedType : undefined
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}
                {operation.inputs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Inputs
                        </p>
                        <div className="space-y-2">
                            {operation.inputs.map((line) => (
                                <PlanOperationItemRow key={`main-in-${line.item_id}`} line={line} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PlanChildOperationCard({ operation }: { operation: PlanStructureOperation }) {
    return (
        <div className="rounded-lg border border-border/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-muted/20 px-4 py-3">
                <p className="text-sm font-bold text-foreground">
                    <span className="font-mono">{operation.code}</span>
                    <span className="text-muted-foreground font-normal"> • </span>
                    {operation.name}
                </p>
            </div>
            <div className="space-y-4 p-4">
                {operation.outputs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Output
                        </p>
                        <div className="space-y-2">
                            {operation.outputs.map((line) => (
                                <PlanOperationItemRow key={`child-out-${operation.id}-${line.item_id}`} line={line} />
                            ))}
                        </div>
                    </div>
                )}
                {operation.inputs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Inputs
                        </p>
                        <div className="space-y-2">
                            {operation.inputs.map((line) => (
                                <PlanOperationItemRow key={`child-in-${operation.id}-${line.item_id}`} line={line} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PlanOperationItemRow({
    line,
    highlighted,
    typeOverride,
}: {
    line: PlanStructureLine;
    highlighted?: boolean;
    typeOverride?: string;
}) {
    const badgeType = typeOverride ?? line.type;
    return (
        <div
            className={cn(
                "rounded-md border px-3 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                highlighted ? "border-blue-200 bg-blue-50/80" : "border-border bg-white",
            )}
        >
            <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                    {line.item_code && (
                        <span className="font-mono text-muted-foreground">{line.item_code} • </span>
                    )}
                    {line.item_name}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
                <Badge
                    variant="outline"
                    className={cn("text-[10px] font-semibold uppercase", planTypeBadgeClass(badgeType))}
                >
                    {badgeType}
                </Badge>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Required Qty</p>
                    <p className="text-sm font-mono font-bold">{formatPlanQty(line.quantity, line.uom)}</p>
                </div>
            </div>
        </div>
    );
}

// Mock plans migrated to shared data

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductionPlan() {
    const { isMenuVisible, canCreate, canEdit, canDelete, canView } = useHasPermission();
    const permissionModule = "PRODUCTION/PRODUCTION_PLAN";

    const { toast } = useToast();

    // Table State
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [opFilter, setOpFilter] = useState("All");
    const appliedOpFilterDefault = useRef(false);
    const [areListFiltersReady, setAreListFiltersReady] = useState(
        () => getAssignedIds("operation").length === 0
    );
    const [shiftFilter, setShiftFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [filterDate, setFilterDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Common Store Data
    const productionPlanStatuses = useCommonStore(state => state.productionPlanStatuses);
    const [shifts, setShifts] = useState<any[]>([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Dynamic Operations State
    const [operations, setOperations] = useState<any[]>([]);
    const [listOperations, setListOperations] = useState<any[]>([]);
    const [isOpsLoading, setIsOpsLoading] = useState(false);

    const assignedOperationIds = getAssignedIds("operation");

    const orderedListOperations = useMemo(
        () => prioritizeByAssigned(listOperations, assignedOperationIds, (o) => o.id || o.operation_id),
        [listOperations, assignedOperationIds]
    );

    const orderedOperations = useMemo(
        () => prioritizeByAssigned(operations, assignedOperationIds, (op) => op.id),
        [operations, assignedOperationIds]
    );

    const operationSelectOptions = useMemo(
        () =>
            orderedOperations.map((op) => {
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
        [orderedOperations, listOperations]
    );

    const loadOperationsWithOutput = async () => {
        setIsOpsLoading(true);
        try {
            const res = await commonApi.getOperationsWithOutput();
            if (res.isSuccessful && res.data?.records) {
                const opsMap = new Map();
                res.data.records.forEach((record: {
                    operation: { operation_id: number; operation_name: string; operation_code?: string; code?: string };
                    output_component?: { item_id: number; item_name: string; item_code: string; uom: string; item_type: string };
                    output_components?: { item_id: number; item_name: string; item_code: string; uom: string; item_type: string }[];
                }) => {
                    const opId = record.operation.operation_id;
                    if (!opsMap.has(opId)) {
                        opsMap.set(opId, {
                            id: opId,
                            name: record.operation.operation_name,
                            code: String(record.operation.operation_code || record.operation.code || "").trim(),
                            outputs: []
                        });
                    }
                    
                    const op = opsMap.get(opId);
                    const outputList = Array.isArray(record.output_components)
                        ? record.output_components
                        : record.output_component
                            ? [record.output_component]
                            : [];

                    outputList.forEach((outComp) => {
                        if (outComp && !op.outputs.some((o: { item_id: number }) => o.item_id === outComp.item_id)) {
                            op.outputs.push({
                                item_id: outComp.item_id,
                                quantity: "",
                                item: {
                                    id: outComp.item_id,
                                    name: outComp.item_name,
                                    code: outComp.item_code,
                                    uom: outComp.uom,
                                    type: outComp.item_type
                                }
                            });
                        }
                    });
                });
                setOperations(Array.from(opsMap.values()));
            }
        } catch (err) {
            console.error("Failed to load operations with output", err);
        } finally {
            setIsOpsLoading(false);
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Fetch specialized production shifts
                const shiftRes = await productionApi.getShiftForProduction();
                if (shiftRes.isSuccessful && shiftRes.data?.records) {
                    setShifts(shiftRes.data.records.map((r: { shift_id?: number; id?: number; value_id?: number; shift_name?: string; name?: string; value_name?: string }) => ({
                        ...r,
                        id: r.shift_id || r.id || r.value_id,
                        name: r.shift_name || r.name || r.value_name || "Unknown",
                        value_name: r.shift_name || r.name || r.value_name || "Unknown",
                    })));
                }

                // Fetch operations for listing filters
                const listRes = await commonApi.getOperations();
                let operationRecords: any[] = [];
                if (listRes.isSuccessful && listRes.data?.records) {
                    operationRecords = listRes.data.records;
                    setListOperations(operationRecords);
                }

                if (
                    !appliedOpFilterDefault.current &&
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
                        setOpFilter(String(firstAssigned));
                        appliedOpFilterDefault.current = true;
                    }
                }
            } catch (err) {
                console.error("Failed to load operations", err);
            } finally {
                setAreListFiltersReady(true);
            }
        };
        loadInitialData();
    }, []);

    const getStatusCode = (status_id: string | number) => {
        const match = productionPlanStatuses.find(
            s => s.id === status_id || s.value_code === status_id || s.value_name === status_id
        );
        return match?.value_code || (typeof status_id === 'string' ? status_id.toUpperCase().replace(/\s+/g, '_') : "TO_DO");
    };

    const getStatusLabel = (status_code: string) => {
        const match = productionPlanStatuses.find(s => s.value_code === status_code);
        return match?.value_name || "To Do";
    };

    // Data State
    const [plans, setPlans] = useState<DailyFGPlan[]>([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const listFetchIdRef = useRef(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [openingPlanId, setOpeningPlanId] = useState<number | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);

    const getStatusIdByLabel = (label: string) => {
        const match = productionPlanStatuses.find(s => s.value_name === label);
        return match?.id;
    };

    const fetchPlans = async () => {
        const fetchId = ++listFetchIdRef.current;
        setIsListLoading(true);
        setListError(null);
        try {
            // Find operation ID from listing dynamic state
            const response = await productionApi.getProductionPlanList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm || undefined,
                operation_id: opFilter === "All" ? undefined : opFilter, 
                shift_id: shiftFilter === "All" ? undefined : shiftFilter, 
                status_id: statusFilter === "All" ? undefined : getStatusIdByLabel(statusFilter),
                date: filterDate ? format(parseDateString(filterDate), 'yyyy-MM-dd') : undefined,
            });

            if (listFetchIdRef.current !== fetchId) return;

            if (response.isSuccessful && response.data) {
                const mappedPlans = response.data.records.map((record: { id: number; plan_code?: string; start_date: string; end_date: string; operation_name?: string; output?: any[]; status_id?: number | string; status_code?: string; shift_name?: string }) => {
                    const outputs = Array.isArray(record.output)
                        ? record.output.map((out: any) => ({
                            itemId: String(out.item_id || ""),
                            itemName: out.item_name || "",
                            itemCode: out.item_code || "",
                            plannedQty: String(out.target_qty ?? "0"),
                            fulfilledQty: String(out.fulfilled_qty ?? "0"),
                            uom: out.uom || "nos",
                            skuId: String(out.sku_id ?? ""),
                            skuCode: out.sku_code || "",
                            skuName: out.sku_name || "",
                        }))
                        : [];
                    const firstOutput = outputs[0] ?? {
                        itemId: "",
                        itemName: "",
                        itemCode: "",
                        plannedQty: "0",
                        fulfilledQty: "0",
                        uom: "nos",
                    };
                    
                    const status_code = getStatusCode(record.status_id || record.status_code!);
                    const status_label = getStatusLabel(status_code);

                    return {
                        id: record.id,
                        planCode: record.plan_code || "",
                        startDate: record.start_date ? format(new Date(record.start_date), "dd-MM-yyyy") : "",
                        endDate: record.end_date ? format(new Date(record.end_date), "dd-MM-yyyy") : "",
                        operationName: record.operation_name || "",
                        itemId: firstOutput.itemId,
                        itemName: firstOutput.itemName,
                        itemCode: firstOutput.itemCode,
                        shift: record.shift_name || "Morning",
                        plannedQty: firstOutput.plannedQty,
                        fulfilledQty: firstOutput.fulfilledQty,
                        uom: firstOutput.uom,
                        status: status_label as PlanStatus,
                        outputs,
                    };
                });
                setPlans(mappedPlans);
                setTotalRecords(response.data.pagination.total_records || 0);
                setListError(null);
            } else {
                setPlans([]);
                setTotalRecords(0);
                setListError(response.message || "Failed to load production plans.");
            }
        } catch (error) {
            if (listFetchIdRef.current !== fetchId) return;
            console.error("Failed to fetch production plans:", error);
            setPlans([]);
            setTotalRecords(0);
            setListError("Failed to load production plans.");
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load production plans"
            });
        } finally {
            if (listFetchIdRef.current === fetchId) {
                setIsListLoading(false);
            }
        }
    };

    useEffect(() => {
        if (!areListFiltersReady) return;
        // Since we are dependent on master data for status mapping, only fetch when it's ready.
        if (productionPlanStatuses.length > 0 || productionPlanStatuses !== undefined) {
            fetchPlans();
        }
    }, [currentPage, itemsPerPage, debouncedSearchTerm, opFilter, shiftFilter, statusFilter, filterDate, productionPlanStatuses, areListFiltersReady]);

    // Dialog State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">("create");
    const [currentPlan, setCurrentPlan] = useState<DailyFGPlan | null>(null);

    // Form State
    const [formStartDate, setFormStartDate] = useState(format(new Date(), "dd-MM-yyyy"));
    const [formEndDate, setFormEndDate] = useState(format(new Date(), "dd-MM-yyyy"));
    const [formShift, setFormShift] = useState("");
    const [selectedOpId, setSelectedOpId] = useState("");
    const [selectedFinishedGoodId, setSelectedFinishedGoodId] = useState("");
    const [selectedSkuId, setSelectedSkuId] = useState("");
    const [skuRecords, setSkuRecords] = useState<SkuRecord[]>([]);
    const [formTargetQty, setFormTargetQty] = useState("");
    const [planOperationTreeBase, setPlanOperationTreeBase] = useState<PlanOperationTree | null>(null);
    const [isPlanTreeDemo, setIsPlanTreeDemo] = useState(false);
    const [isPlanTreeLoading, setIsPlanTreeLoading] = useState(false);
    const [formOutputs, setFormOutputs] = useState<any[]>([]);
    const [formStatus, setFormStatus] = useState<PlanStatus>("To Do");
    const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null);
    const [bomComponentRecords, setBomComponentRecords] = useState<any[]>([]);

    const finishedGoodOptions = useMemo(() => {
        const seen = new Set<number>();
        const options: {
            value: string;
            label: string;
            primaryText: string;
            secondaryText?: string;
            item: { id: number; code: string; name: string; uom: string; type: string };
            operationId: number;
            hasBom: boolean;
        }[] = [];

        const pushOption = (itemId: number, code: string, name: string, uom: string, typeRaw: string, hasBom: boolean) => {
            if (!itemId || seen.has(itemId)) return;
            if (!isFinishedGoodType(typeRaw)) return;
            seen.add(itemId);
            const opId = resolveOperationIdForOutputItem(itemId, operations);
            options.push({
                value: String(itemId),
                label: code ? `${code} — ${name}` : name,
                primaryText: name,
                secondaryText: code || undefined,
                item: {
                    id: itemId,
                    code,
                    name,
                    uom: uom || "Nos",
                    type: normalizePlanItemType(typeRaw),
                },
                operationId: opId,
                hasBom,
            });
        };

        bomComponentRecords.forEach((r) => {
            const oc = r.output_component || {};
            const itemId = Number(oc.id);
            const code = String(oc.code || oc.item_code || "").trim();
            const name = String(oc.name || oc.item_name || "Unknown").trim();
            const uom = String(oc.uom || oc.uom_name || "Nos").trim();
            const typeRaw = String(oc.item_type ?? oc.type ?? "FG");
            pushOption(itemId, code, name, uom, typeRaw, true);
        });

        operations.forEach((op) => {
            (op.outputs || []).forEach((out: any) => {
                const itemId = Number(out.item_id);
                const typeRaw = String(out.item?.type ?? "").trim();
                pushOption(
                    itemId,
                    String(out.item?.code ?? "").trim(),
                    String(out.item?.name ?? "Unknown").trim(),
                    String(out.item?.uom ?? "Nos").trim(),
                    typeRaw,
                    false,
                );
            });
        });

        return options;
    }, [bomComponentRecords, operations]);

    const selectedFinishedGood = useMemo(
        () => finishedGoodOptions.find((o) => o.value === selectedFinishedGoodId),
        [finishedGoodOptions, selectedFinishedGoodId],
    );

    const isGsv7PlanItem = Boolean(
        selectedFinishedGood && isGsv7CatalogItemCode(selectedFinishedGood.item.code),
    );

    const filteredSkuDropdownOptions = useMemo(() => {
        const itemId = selectedFinishedGood?.item.id;
        let list = skuRecords;
        if (itemId && Number.isFinite(itemId)) {
            const forItem = skuRecords.filter((s) => Number(s.item_id) === Number(itemId));
            if (forItem.length > 0) list = forItem;
        }
        return list.map((s) => ({
            value: String(s.id),
            label: `${s.code} — ${s.name}`,
            primaryText: s.name,
            secondaryText: s.code,
        }));
    }, [skuRecords, selectedFinishedGood?.item.id]);

    const effectiveTargetQty = useMemo(() => {
        const qty = parseFloat(String(formTargetQty).replace(/,/g, ""));
        return Number.isFinite(qty) && qty > 0 ? qty : null;
    }, [formTargetQty]);

    const displayPlanTree = useMemo(() => {
        if (!planOperationTreeBase || !selectedFinishedGood) return null;
        if (effectiveTargetQty == null) return planOperationTreeBase;
        return scalePlanTree(
            planOperationTreeBase,
            selectedFinishedGood.item.id,
            effectiveTargetQty,
        );
    }, [planOperationTreeBase, selectedFinishedGood, effectiveTargetQty]);

    const bomSummaryText = useMemo(() => {
        if (!selectedFinishedGood) return "";
        const code = selectedFinishedGood.item.code || selectedFinishedGood.item.name;
        if (effectiveTargetQty != null) {
            return `${code} × ${effectiveTargetQty.toLocaleString()} → quantities calculated from BOM (per-unit × target)`;
        }
        return `${code} → BOM loaded · enter target quantity to calculate required amounts`;
    }, [selectedFinishedGood, effectiveTargetQty]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, opFilter, shiftFilter, statusFilter, filterDate]);

    /**
     * Date Range Validation Logic:
     * 1. End Date must be greater than or equal to Start Date.
     * 2. The total duration cannot exceed 30 days per user requirement.
     */
    const getDateRangeError = () => {
        if (!formStartDate || !formEndDate) return null;
        const start = parseDateString(formStartDate);
        const end = parseDateString(formEndDate);
        
        if (isBefore(end, start)) {
            return "End Date must be greater than or equal to Start Date";
        }
        
        const days = differenceInDays(end, start);
        if (days > 30) {
            return "Maximum range between start and end date is 30 days";
        }
        
        return null;
    };

    // Validation
    const isFormValid = () => {
        const targetQty = parseFloat(String(formTargetQty).replace(/,/g, ""));
        if (dialogMode === "create") {
            return (
                formShift !== "" &&
                selectedFinishedGoodId !== "" &&
                Number.isFinite(targetQty) &&
                targetQty > 0 &&
                targetQty <= 999999999999 &&
                selectedOpId !== "" &&
                formOutputs.length > 0 &&
                !getDateRangeError()
            );
        }
        return (
            selectedOpId !== "" &&
            formShift !== "" &&
            formOutputs.length > 0 &&
            formOutputs.every((o) => o.quantity > 0 && o.quantity <= 999999999999) &&
            !getDateRangeError()
        );
    };

    useEffect(() => {
        if (dialogMode !== "create" || !dialogOpen) return;
        if (!selectedFinishedGoodId || !selectedFinishedGood) {
            setPlanOperationTreeBase(null);
            setIsPlanTreeDemo(false);
            setSelectedOpId("");
            setFormOutputs([]);
            return;
        }

        let cancelled = false;
        setIsPlanTreeLoading(true);

        const bomRecord = findBomRecordByOutputItemId(
            bomComponentRecords,
            selectedFinishedGood.item.id,
        );
        const hasBomComponents =
            Array.isArray(bomRecord?.input_components) && bomRecord.input_components.length > 0;

        if (isGsv7CatalogItemCode(selectedFinishedGood.item.code)) {
            const planTree = buildGsv7PlanTreeFromBom(selectedFinishedGood.item.code, bomRecord);
            if (cancelled) return;
            if (planTree) {
                setIsPlanTreeDemo(false);
                setPlanOperationTreeBase(planTree);
                setSelectedOpId(String(planTree.mainOperation.id));
            } else {
                setPlanOperationTreeBase(null);
                setSelectedOpId(String(selectedFinishedGood.operationId));
            }
            setIsPlanTreeLoading(false);
            return () => {
                cancelled = true;
            };
        }

        buildPlanTreeForFinishedGood(
            selectedFinishedGood.item,
            selectedFinishedGood.operationId,
            bomRecord,
            operations,
        )
            .then((tree) => {
                if (cancelled) return;
                const { tree: enriched, isDemo } = enrichPlanTreeWithDemoIfThin(
                    tree,
                    selectedFinishedGood.item,
                    hasBomComponents,
                );
                setIsPlanTreeDemo(isDemo);
                setPlanOperationTreeBase(enriched);
                if (enriched) {
                    setSelectedOpId(String(enriched.mainOperation.id));
                } else {
                    setSelectedOpId(String(selectedFinishedGood.operationId));
                }
            })
            .catch((err) => {
                console.error("Failed to build plan operation tree:", err);
                if (!cancelled) setPlanOperationTreeBase(null);
            })
            .finally(() => {
                if (!cancelled) setIsPlanTreeLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [dialogMode, dialogOpen, selectedFinishedGoodId, selectedFinishedGood, bomComponentRecords, operations]);

    useEffect(() => {
        if (dialogMode !== "create" || !selectedFinishedGood) return;
        if (!planOperationTreeBase) {
            setFormOutputs([]);
            return;
        }
        if (effectiveTargetQty == null) {
            setFormOutputs([]);
            return;
        }
        setSelectedOpId(String(planOperationTreeBase.mainOperation.id));
        setFormOutputs([
            {
                item_id: selectedFinishedGood.item.id,
                quantity: String(effectiveTargetQty),
                item: {
                    id: selectedFinishedGood.item.id,
                    name: selectedFinishedGood.item.name,
                    code: selectedFinishedGood.item.code,
                    uom: selectedFinishedGood.item.uom,
                    type: selectedFinishedGood.item.type,
                },
            },
        ]);
    }, [dialogMode, planOperationTreeBase, selectedFinishedGood, effectiveTargetQty]);

    useEffect(() => {
        if (dialogMode === "create") return;
        if (!selectedOpId) return;
        const matchedOp = operations.find((op) => String(op.id) === String(selectedOpId));
        if (matchedOp) {
            setFormOutputs(matchedOp.outputs.map((o: { item_id: number; quantity: string; item: any }) => ({ ...o })));
        }
    }, [selectedOpId, dialogMode, operations]);

    // Handlers
    const handleCreatePlan = async () => {
        if (openingPlanId !== null || isSaving || isOpsLoading) return;

        setDialogMode("create");
        setCurrentPlan(null);
        setFormStartDate(format(new Date(), "dd-MM-yyyy"));
        setFormEndDate(format(new Date(), "dd-MM-yyyy"));
        setFormShift("");
        setSelectedOpId("");
        setSelectedFinishedGoodId("");
        setSelectedSkuId("");
        setFormTargetQty("");
        setPlanOperationTreeBase(null);
        setIsPlanTreeDemo(false);
        setBomComponentRecords([]);
        setSkuRecords([]);
        setFormOutputs([]);
        setFormStatus("To Do");
        setDialogOpen(true);
        await Promise.all([
            loadOperationsWithOutput(),
            commonApi.getBOMComponents().then((res) => {
                const apiRecords =
                    res.isSuccessful && res.data?.records ? res.data.records : [];
                const apiCodes = new Set(
                    apiRecords.map((r: { output_component?: { code?: string } }) =>
                        String(r.output_component?.code ?? "").trim().toUpperCase(),
                    ),
                );
                const gsv7Records = getAllGsv7BomComponentRecords().filter(
                    (r) => !apiCodes.has(String(r.output_component.code).trim().toUpperCase()),
                );
                setBomComponentRecords([...gsv7Records, ...apiRecords]);
            }),
        ]);
        try {
            setSkuRecords(loadProcurementSkuRecords());
        } catch {
            setSkuRecords([]);
        }
    };


    const fetchAndOpenPlan = async (id: number, mode: "edit" | "view") => {
        if (openingPlanId !== null || isSaving) return;

        setOpeningPlanId(id);
        setDialogMode(mode);
        setCurrentPlan(null);
        setFormStartDate("");
        setFormEndDate("");
        setFormShift("");
        setSelectedOpId("");
        setFormOutputs([]);
        setDialogOpen(true);
        setIsDetailLoading(true);

        try {
            await loadOperationsWithOutput();
            const res = await productionApi.getProductionPlanById(id);
            if (res.isSuccessful && res.data) {
                const planData = res.data;
                const listPlan = plans.find(p => p.id === id);

                // Preserve status logic so it does not affect UI enable/disable status checks
                const currentStatus = listPlan ? listPlan.status : "To Do";

                setCurrentPlan({
                    id: id,
                    planCode: planData.plane_code || planData.plan_code || listPlan?.planCode || "",
                    startDate: format(new Date(planData.start_date), "dd-MM-yyyy"),
                    endDate: format(new Date(planData.end_date), "dd-MM-yyyy"),
                    operationName: planData.operation_name,
                    itemId: planData.outputs?.[0]?.item_id || "",
                    itemCode: planData.outputs?.[0]?.item_code || "",
                    itemName: planData.outputs?.[0]?.item_name || "",
                    shift: planData.shift_name,
                    plannedQty: planData.outputs?.[0]?.target_qty?.toString() || "0",
                    fulfilledQty: "0",
                    uom: planData.outputs?.[0]?.uom || "",
                    status: currentStatus,
                });

                setFormStartDate(format(new Date(planData.start_date), "dd-MM-yyyy"));
                setFormEndDate(format(new Date(planData.end_date), "dd-MM-yyyy"));
                setFormShift(planData.shift_name);
                setFormStatus(currentStatus);
                setSelectedOpId(String(planData.operation_id));
                setFormOutputs(planData.outputs ? planData.outputs.map((out: { id: number; item_id: number; target_qty: number; item_name: string; item_code: string; uom: string }) => ({
                    id: out.id,
                    item_id: out.item_id,
                    quantity: out.target_qty,
                    item: { id: out.item_id, name: out.item_name, code: out.item_code, uom: out.uom }
                })) : []);
            } else {
                toast({ variant: "destructive", title: "Error", description: res.message || "Failed to load plan details." });
                setDialogOpen(false);
            }
        } catch (error) {
            console.error("Failed to load plan details", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load plan details." });
            setDialogOpen(false);
        } finally {
            setIsDetailLoading(false);
            setOpeningPlanId(null);
        }
    };

    const handleEditPlan = (id: number) => fetchAndOpenPlan(id, "edit");
    const handleViewPlan = (id: number) => fetchAndOpenPlan(id, "view");

    const handleDeletePlan = async () => {
        if (!currentPlan || isSaving) return;
        if (getStatusCode(currentPlan.status) !== "TO_DO") {
            toast({
                variant: "destructive",
                title: "Cannot Delete",
                description: "Only production plans in To Do status can be deleted.",
            });
            return;
        }

        setIsSaving(true);
        try {
            const response = await productionApi.deleteProductionPlan(currentPlan.id);
            if (response.isSuccessful) {
                toast({
                    variant: "success",
                    title: "Deleted",
                    description: response.message || "Production Plan removed successfully",
                    duration: 5000
                });
                setDialogOpen(false);
                setIsDeleteConfirmOpen(false);
                fetchPlans();
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: response.message || "Failed to delete production plan",
                });
            }
        } catch (error: any) {
            console.error("Delete Production Plan Error:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to delete production plan",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!isFormValid() || isSaving || isDetailLoading) return;

        setIsSaving(true);
        if (dialogMode === "create") {
            try {
                // Resolve Shift ID
                const shiftRecord = shifts.find(s => s.name === formShift || s.value_name === formShift);
                const shift_id = shiftRecord?.id || 10; // Fallback to 10 based on example if not found

                // Resolve Operation ID
                const opIdNumber = parseInt(String(selectedOpId)) || 1;

                // Map Outputs
                const payloadOutputs = formOutputs.map(out => ({
                    item_id: parseInt(String(out.item_id)) || 201,
                    target_qty: parseFloat(out.quantity) || 0
                }));

                const payload = {
                    start_date: format(parseDateString(formStartDate), 'yyyy-MM-dd'),
                    end_date: format(parseDateString(formEndDate), 'yyyy-MM-dd'),
                    shift_id: shift_id,
                    operation_id: opIdNumber,
                    outputs: payloadOutputs
                };

                const response = await productionApi.createProductionPlan(payload);

                if (response.isSuccessful) {
                    toast({
                        variant: "success",
                        title: "Success",
                        description: response.message || "Production plan created successfully",
                        duration: 5000
                    });
                    
                    fetchPlans(); // Refresh list from server
                    setDialogOpen(false);
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: response.message || "Failed to create production plan",
                    });
                }
            } catch (error: any) {
                console.error("Create Production Plan Error:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to create production plan",
                });
            } finally {
                setIsSaving(false);
            }
        } else if (dialogMode === "edit" && currentPlan) {
            try {
                // Resolve Shift ID
                const shiftRecord = shifts.find(s => s.name === formShift || s.value_name === formShift);
                const shift_id = shiftRecord?.id || 10;

                // Map Outputs (include id for existing output rows)
                const payloadOutputs = formOutputs.map(out => ({
                    id: out.id,
                    item_id: parseInt(String(out.item_id)) || 201,
                    target_qty: parseFloat(out.quantity) || 0
                }));

                const payload = {
                    start_date: format(parseDateString(formStartDate), 'yyyy-MM-dd'),
                    end_date: format(parseDateString(formEndDate), 'yyyy-MM-dd'),
                    shift_id: shift_id,
                    outputs: payloadOutputs
                };

                const response = await productionApi.updateProductionPlan(currentPlan.id, payload);

                if (response.isSuccessful) {
                    toast({
                        variant: "success",
                        title: "Updated",
                        description: response.message || "Production Plan updated successfully",
                        duration: 5000
                    });

                    fetchPlans(); // Refresh list from server
                    setDialogOpen(false);
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: response.message || "Failed to update production plan",
                    });
                }
            } catch (error: any) {
                console.error("Update Production Plan Error:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to update production plan",
                });
            } finally {
                setIsSaving(false);
            }
        } else {
            setDialogOpen(false);
            setIsSaving(false);
        }
    };

    const handleForceClose = async (id: number) => {
        try {
            // Resolve the "Completed" status ID from master data
            const completedStatus = productionPlanStatuses.find(s => s.value_code === "COMPLETED");
            const status_id = completedStatus?.id || 5;

            const response = await productionApi.updateStatusToCompleted(id, { status_id: String(status_id) });

            if (response.isSuccessful) {
                toast({
                    variant: "success",
                    title: "Production Completed",
                    description: response.message || "Production plan has been marked as completed.",
                    duration: 5000
                });
                setDialogOpen(false);
                fetchPlans();
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: response.message || "Failed to complete production plan.",
                });
            }
        } catch (error: any) {
            console.error("Complete Production Error:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to complete production plan.",
            });
        }
    };

    const isRowActionBusy = openingPlanId !== null || isSaving;

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Production Plan Management</h1>

            {/* DAILY FG PLAN CONTENT */}
            <div className="flex-1 flex flex-col gap-6">
                {/* Search Section with Filters and Create Button - MATCHING MATERIAL OPERATION STYLE */}
                <AppListToolbar
                    search={{
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: "Search code..."
                    }}
                    filters={[
                        {
                            type: 'select',
                            label: 'Operation',
                            value: opFilter,
                            options: [
                                { label: "All Operations", value: "All" },
                                ...orderedListOperations.map(o => ({ 
                                    label: o.operation_name || o.name, 
                                    value: String(o.id || o.operation_id) 
                                }))
                            ],
                            onChange: setOpFilter,
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
                                { label: "To Do", value: "To Do" },
                                { label: "In Progress", value: "In Progress" },
                                { label: "Completed", value: "Completed" },
                                { label: "Overdue", value: "Overdue" }
                            ],
                            onChange: setStatusFilter,
                            searchable: true
                        },
                        {
                            type: 'date',
                            label: 'Date',
                            value: filterDate ? parseDateString(filterDate) : undefined,
                            onChange: (date) => setFilterDate(date ? format(date, "dd-MM-yyyy") : ""),
                            showClear: !!filterDate
                        }
                    ]}
                    actions={[
                        ...(canCreate(permissionModule) ? [{
                            label: "Create Plan",
                            icon: <Plus className="h-4 w-4" />,
                            onClick: handleCreatePlan,
                        }] : [])
                    ]}
                />

                <Card>
                    <CardContent className="pt-6">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Plan Code</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>End Date</TableHead>
                                        <TableHead>Operation</TableHead>
                                        <TableHead>Output (Fulfilled / Targeted)</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Shift</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!areListFiltersReady || isListLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-32 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : listError ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-32 text-center">
                                                <div className="flex flex-col items-center justify-center gap-2 text-red-500">
                                                    <AlertCircle className="h-8 w-8" />
                                                    <p className="text-sm font-medium">{listError}</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : plans.length > 0 ? (
                                        plans.map((plan) => (
                                            <TableRow key={plan.id}>
                                                <TableCell className="font-mono text-xs font-medium">{plan.planCode}</TableCell>
                                                <TableCell className="text-xs font-semibold text-muted-foreground">{plan.startDate}</TableCell>
                                                <TableCell className="text-xs font-semibold text-muted-foreground">{plan.endDate}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-bold uppercase tracking-tight">
                                                        {plan.operationName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="align-top py-3">
                                                    <div className="flex flex-col gap-1">
                                                        {(plan.outputs && plan.outputs.length > 0
                                                            ? plan.outputs
                                                            : [{
                                                                itemCode: plan.itemCode,
                                                                fulfilledQty: plan.fulfilledQty,
                                                                plannedQty: plan.plannedQty,
                                                            }]
                                                        ).map((out, idx) => (
                                                            <span
                                                                key={`${plan.id}-${out.itemCode || "output"}-${idx}`}
                                                                className="text-xs font-semibold leading-snug text-muted-foreground"
                                                            >
                                                                {out.itemCode} ({out.fulfilledQty} / {out.plannedQty})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top py-3">
                                                    <div className="flex flex-col gap-1">
                                                        {(plan.outputs && plan.outputs.length > 0
                                                            ? plan.outputs
                                                            : [{
                                                                itemCode: plan.itemCode,
                                                                skuCode: "",
                                                                skuName: "",
                                                            }]
                                                        ).map((out, idx) => (
                                                            <span
                                                                key={`${plan.id}-sku-${out.itemCode || "output"}-${idx}`}
                                                                className="text-xs font-semibold leading-snug text-muted-foreground"
                                                            >
                                                                {formatPlanOutputSkuLabel(out)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(
                                                        "font-semibold text-[10px] uppercase",
                                                        plan.shift?.toLowerCase().includes("day") || plan.shift?.toLowerCase().includes("morning") ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    )}>
                                                        {plan.shift}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn(
                                                        "font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide border-none",
                                                        plan.status === "To Do" ? "bg-slate-100 text-slate-700 hover:bg-slate-100" :
                                                        plan.status === "In Progress" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                                        plan.status === "Completed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                                        plan.status === "Overdue" ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                                    )}>
                                                        {plan.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center py-4">
                                                    <div className={cn(isRowActionBusy && "pointer-events-none opacity-50")}>
                                                        <TableActionButtons
                                                            onView={canView(permissionModule) ? () => handleViewPlan(plan.id) : undefined}
                                                            onEdit={(plan.status !== "Completed" && canEdit(permissionModule)) ? () => handleEditPlan(plan.id) : undefined}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                                No Production Plans Found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination - using standardized DataTablePagination component */}
                        {areListFiltersReady && !isListLoading && !listError && totalRecords > 0 && (
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
            </div>

            {/* CREATE/EDIT/VIEW DIALOG */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent
                    ref={setDialogEl}
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="text-lg font-bold tracking-tight sm:text-xl">
                            {dialogMode === "create" ? "Create Production Plan" : dialogMode === "edit" ? "Modify Production Plan" : "Production Plan Details"}
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
                            {dialogMode === "create"
                                ? "Pick the product — the BOM builds the rest."
                                : dialogMode === "edit"
                                    ? "Adjust parameters for existing production schedules"
                                    : "Check configuration and target metrics"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        <div className="space-y-5">
                        {/* PLAN CONFIGURATION SECTION */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                                {dialogMode !== "create" && (
                                    <div className="min-w-0 space-y-1.5 sm:col-span-2">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan Code</Label>
                                        <Input
                                            value={currentPlan?.planCode}
                                            readOnly
                                            className="pointer-events-none h-9 border-none bg-muted font-mono text-sm font-semibold"
                                        />
                                    </div>
                                )}
                                <div className="min-w-0 space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Start Date <span className="text-red-500">*</span>
                                    </Label>
                                    <SharedDatePicker
                                        date={formStartDate ? parseDateString(formStartDate) : undefined}
                                        setDate={(date) => setFormStartDate(date ? format(date, "dd-MM-yyyy") : "")}
                                        disabled={dialogMode === "view" || (dialogMode === "edit" && currentPlan?.status !== "To Do")}
                                        showClear={false}
                                    />
                                </div>
                                <div className="min-w-0 space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        End Date <span className="text-red-500">*</span>
                                    </Label>
                                    <SharedDatePicker
                                        date={formEndDate ? parseDateString(formEndDate) : undefined}
                                        setDate={(date) => setFormEndDate(date ? format(date, "dd-MM-yyyy") : "")}
                                        disabled={dialogMode === "view" || (dialogMode === "edit" && currentPlan?.status !== "To Do")}
                                        showClear={false}
                                    />
                                    {getDateRangeError() && (
                                        <p className="mt-1 text-[10px] font-bold text-red-500">{getDateRangeError()}</p>
                                    )}
                                </div>
                                <div className="min-w-0 space-y-1.5">
                                    <SharedSearchableSelect
                                        label="Shift *"
                                        value={formShift}
                                        options={shifts.map(s => ({ label: s.value_name || s.name, value: s.value_name || s.name }))}
                                        onChange={(val) => setFormShift(val)}
                                        placeholder="Select shift..."
                                        disabled={dialogMode === "view" || (dialogMode === "edit" && currentPlan?.status !== "To Do")}
                                        className="h-9"
                                        popoverCollisionBoundary={dialogEl}
                                        popoverCollisionPadding={8}
                                    />
                                </div>

                                {dialogMode === "create" ? (
                                    <>
                                        <div className="min-w-0 hidden sm:block" aria-hidden="true" />
                                        <div className="min-w-0 space-y-1.5">
                                            <SharedSearchableSelect
                                                label="Finished Good *"
                                                value={selectedFinishedGoodId}
                                                options={finishedGoodOptions.map((o) => ({
                                                    value: o.value,
                                                    label: o.label,
                                                    primaryText: o.primaryText,
                                                    secondaryText: o.secondaryText,
                                                }))}
                                                onChange={(val) => {
                                                    setSelectedFinishedGoodId(val);
                                                    setSelectedSkuId("");
                                                }}
                                                placeholder="Select finished good..."
                                                disabled={isOpsLoading}
                                                showSelectedTitle
                                                compactStackedSelected
                                                popoverCollisionBoundary={dialogEl}
                                                popoverCollisionPadding={8}
                                                listClassName="max-h-[220px]"
                                            />
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <SharedSearchableSelect
                                                label="SKU"
                                                value={selectedSkuId || undefined}
                                                options={filteredSkuDropdownOptions}
                                                placeholder={
                                                    !selectedFinishedGoodId
                                                        ? "Select finished good first"
                                                        : filteredSkuDropdownOptions.length === 0
                                                          ? "No SKUs for this item"
                                                          : "Select SKU"
                                                }
                                                onChange={(val) => {
                                                    const s = String(val ?? "").trim();
                                                    const skuId = s.includes("|")
                                                        ? String(s.split("|").pop() ?? "").trim()
                                                        : s;
                                                    setSelectedSkuId(skuId);
                                                }}
                                                disabled={
                                                    !selectedFinishedGoodId ||
                                                    filteredSkuDropdownOptions.length === 0
                                                }
                                                showSelectedTitle
                                                compactStackedSelected
                                                popoverCollisionBoundary={dialogEl}
                                                popoverCollisionPadding={8}
                                                listClassName="max-h-[220px]"
                                            />
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Target Qty <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="Enter target quantity"
                                                value={formTargetQty}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 12)) {
                                                        setFormTargetQty(val);
                                                    }
                                                }}
                                                className={cn(
                                                    "h-9 font-mono",
                                                    formTargetQty &&
                                                        parseFloat(formTargetQty) <= 0 &&
                                                        "border-red-500 focus-visible:ring-red-500",
                                                )}
                                            />
                                            {formTargetQty && parseFloat(formTargetQty) <= 0 && (
                                                <p className="text-[10px] font-bold text-red-500">MIN &gt; 0</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="min-w-0 space-y-1.5">
                                        <SharedSearchableSelect
                                            label="Operation *"
                                            value={String(selectedOpId)}
                                            options={operationSelectOptions}
                                            onChange={(val) => setSelectedOpId(val)}
                                            disabled={dialogMode !== "create"}
                                            showSelectedTitle
                                            compactStackedSelected
                                            popoverCollisionBoundary={dialogEl}
                                            popoverCollisionPadding={8}
                                            listClassName="max-h-[200px]"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {dialogMode === "create" && selectedFinishedGoodId && bomSummaryText && (
                            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
                                {bomSummaryText}
                            </div>
                        )}

                        {dialogMode === "create" ? (
                            <div className="space-y-3">
                                <Label className="block border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                                    Operations Generated From BOM
                                </Label>

                                {isDetailLoading || isPlanTreeLoading || isOpsLoading ? (
                                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/5 py-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Loading operation structure...</p>
                                    </div>
                                ) : !selectedFinishedGoodId ? (
                                    <div className="rounded-lg border-2 border-dashed bg-muted/5 py-10 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            Select a finished good to view operations from BOM
                                        </p>
                                    </div>
                                ) : !displayPlanTree ? (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 py-8 text-center px-4">
                                        <p className="text-sm font-medium text-amber-900">No BOM operation flow found</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Configure operation outputs and flow mapping in Production Masters.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {isGsv7PlanItem && (
                                            <p className="text-xs text-blue-900 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                                                BOM quantities loaded (per 1 finished unit). Enter{" "}
                                                <span className="font-semibold">Target Qty</span> to multiply
                                                all inputs and outputs for this production plan.
                                            </p>
                                        )}
                                        {isPlanTreeDemo && !isGsv7PlanItem && (
                                            <p className="text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                                                Sample multi-item BOM layout for preview. Add operation{" "}
                                                <span className="font-semibold">inputs</span> and{" "}
                                                <span className="font-semibold">flow mapping</span> in Production
                                                Masters → Operations to replace this with live data.
                                            </p>
                                        )}
                                        {effectiveTargetQty == null && (
                                            <p className="text-xs text-muted-foreground rounded-md border border-dashed bg-muted/20 px-3 py-2">
                                                Showing BOM quantities for{" "}
                                                <span className="font-semibold">1 unit</span>. Enter{" "}
                                                <span className="font-semibold">Target Qty</span> to scale all
                                                required amounts.
                                            </p>
                                        )}
                                        <div className="space-y-4">
                                            <PlanMainOperationCard
                                                operation={displayPlanTree.mainOperation}
                                                highlightedItemId={selectedFinishedGood?.item.id}
                                                highlightedType={selectedFinishedGood?.item.type}
                                            />
                                            {displayPlanTree.childOperations.length > 0 && (
                                                <div className="space-y-3">
                                                    <p className="text-xs font-semibold text-muted-foreground">
                                                        Related operations from BOM
                                                    </p>
                                                    {displayPlanTree.childOperations.map((child) => (
                                                        <PlanChildOperationCard
                                                            key={child.id}
                                                            operation={child}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                                    <p className="font-semibold text-foreground mb-1">On save:</p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        <li>Production plan is created.</li>
                                        <li>Operations are generated from BOM.</li>
                                        <li>Required quantities are calculated automatically.</li>
                                        <li>Material requirement process can be initiated later.</li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                        <div className="space-y-3">
                            <Label className="block border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                                Target Outputs (SFG / FG)
                            </Label>
                            {isDetailLoading ? (
                                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/5 py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                </div>
                            ) : formOutputs.length > 0 ? (
                                <div
                                    className={cn(
                                        "overflow-x-auto rounded-md border border-border/60 shadow-sm",
                                        formOutputs.length > 4 && "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                    )}
                                >
                                    <Table className="w-full min-w-[640px] table-fixed">
                                        <colgroup>
                                            <col className="w-[52%]" />
                                            <col className="w-[16%]" />
                                            <col className="w-[32%]" />
                                        </colgroup>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableHead className="py-3 pl-4 text-[10px] font-bold uppercase tracking-wider">
                                                    Item Details
                                                </TableHead>
                                                <TableHead className="py-3 text-center text-[10px] font-bold uppercase tracking-wider">
                                                    UOM
                                                </TableHead>
                                                <TableHead className="py-3 pr-4 text-right text-[10px] font-bold uppercase tracking-wider">
                                                    Target Qty
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-background">
                                            {formOutputs.map((out: any, idx: number) => (
                                                <TableRow key={idx} className="hover:bg-muted/5">
                                                    <TableCell className="max-w-0 overflow-hidden align-top py-3 pl-4">
                                                        <div className="min-w-0 pr-2">
                                                            <p className="m-0 text-sm font-medium leading-snug wrap-break-word text-slate-900">
                                                                {out.item?.name}
                                                            </p>
                                                            <p className="m-0 mt-0.5 font-mono text-[10px] leading-snug break-all text-muted-foreground">
                                                                {out.item?.code}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="align-top py-3 text-center">
                                                        <Badge variant="secondary" className="text-[10px] uppercase">
                                                            {out.item?.uom}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="align-top py-3 pr-4">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={out.quantity}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    // Allow only numbers and one decimal point, max 12 digits total
                                                                    if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 12)) {
                                                                        const newOutputs = [...formOutputs];
                                                                        newOutputs[idx] = { ...out, quantity: val };
                                                                        setFormOutputs(newOutputs);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "h-8 w-28 text-right font-mono font-bold focus-visible:ring-primary/20 sm:w-32",
                                                                    (parseFloat(out.quantity) <= 0 || parseFloat(out.quantity) > 999999999999) && "border-red-500 focus-visible:ring-red-500/20 text-red-600"
                                                                )}
                                                                placeholder="0.00"
                                                                disabled={dialogMode === "view" || (dialogMode === "edit" && currentPlan?.status === "Overdue")}
                                                            />
                                                            {out.quantity <= 0 && (
                                                                <span className="text-[9px] font-bold uppercase tracking-tighter text-red-500">
                                                                    MIN &gt; 0
                                                                </span>
                                                            )}
                                                            {out.quantity > 999999999999 && (
                                                                <span className="text-[9px] font-bold uppercase tracking-tighter text-red-500">
                                                                    MAX 999B+
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="rounded-lg border-2 border-dashed bg-muted/5 py-8 text-center">
                                    <p className="text-sm text-muted-foreground">Select an Operation to view target production outputs</p>
                                </div>
                            )}
                        </div>
                        )}
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 items-center justify-between gap-2 border-t bg-background px-4 pb-4 pt-3 sm:px-5">
                        {dialogMode === "edit" && currentPlan?.status === "To Do" && canDelete(permissionModule) && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                disabled={isSaving || isDetailLoading}
                                className="mr-auto h-9 gap-2 px-4"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Plan
                            </Button>
                        )}
                        {dialogMode === "edit" && currentPlan?.status === "Overdue" && canEdit(permissionModule) && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (currentPlan) handleForceClose(currentPlan.id);
                                    setDialogOpen(false);
                                }}
                                className="mr-auto h-9 gap-2 border-[#0056B8] bg-[#0056B8] px-4 text-white shadow-sm hover:bg-[#0056B8]/90"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Complete Production
                            </Button>
                        )}
                        <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            disabled={isSaving}
                            className="h-9 w-full sm:w-auto"
                        >
                            {dialogMode === "view" ? "Close" : "Cancel"}
                        </Button>
                        {dialogMode !== "view" && (dialogMode === "create" || currentPlan?.status !== "Overdue") && (
                            <Button
                                onClick={handleSave}
                                loading={isSaving}
                                disabled={!isFormValid() || isDetailLoading || (dialogMode === "create" && isPlanTreeLoading)}
                                className={cn(
                                    "h-9 w-full px-8 sm:w-auto",
                                    isFormValid()
                                        ? "bg-[#0056B8] text-white hover:bg-[#0056B8]/90 border-[#0056B8]"
                                        : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
                                )}
                            >
                                {dialogMode === "create" ? "Save Plan" : "Update Changes"}
                            </Button>
                        )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Production Plan</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete production plan{" "}
                            <span className="font-semibold">{currentPlan?.planCode}</span>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeletePlan();
                            }}
                            disabled={isSaving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isSaving ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
