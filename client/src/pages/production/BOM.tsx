import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format, parse, isValid } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Trash2, Calendar as CalendarIcon, ChevronDown, X, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";
import { productionApi, BOMListRecord, commonApi, operationsApi } from "@/lib/api";
import {
    BOM_SFG_FG_MOCK_DROPDOWN_ONLY,
    buildGsv7NestedBomTree,
    getAllGsv7BomComponentRecords,
    getGsv7ItemIdByCode,
    gsv7TreeToTopLevelComponents,
    isGsv7CatalogItemCode,
} from "@/lib/gsv7BomTreeBuilder";
import { useCommonStore } from "@/store/commonStore";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { loadProcurementSkuRecords, type SkuRecord } from "@/pages/masters/ProcurementSkuTab";

// ============================================================================
// HELPERS & MOCK DATA
// ============================================================================

const formatDate = (date: Date | string): string => {
    if (!date) return "N/A";
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};
// Mock data removed in favor of backend APIs

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

const BOM_NAME_MIN_LEN = 2;
const BOM_NAME_MAX_LEN = 150;
const BOM_DESC_MAX_LEN = 200;

/** Unique option value per getbomcomponents row (same item name can appear multiple times). */
const getBomComponentOptionValue = (record: any, index: number): string =>
    String(record.id ?? record.bom_component_id ?? `${record.output_component?.id ?? "item"}-${index}`);

const buildUomMap = (uoms: any[]): Record<number, string> => {
    const map: Record<number, string> = {};
    const add = (rawId: unknown, label: string) => {
        const n = Number(rawId);
        if (Number.isFinite(n) && n > 0 && label) map[n] = label;
    };
    uoms.forEach((u: any) => {
        const label = String(u.name || u.uom_name || u.value_name || u.code || u.value_code || "").trim();
        add(u.value_id, label);
        add(u.id, label);
        add(u.uom_id, label);
    });
    return map;
};

const resolveUomLabel = (
    uomMap: Record<number, string>,
    uomId?: number | string | null,
    ...apiFields: (string | null | undefined)[]
): string => {
    for (const field of apiFields) {
        const fromApi = String(field ?? "").trim();
        if (fromApi) return fromApi;
    }
    const id = Number(uomId);
    if (Number.isFinite(id) && id > 0) return uomMap[id] || "";
    return "";
};

const mapBomDetailComponent = (comp: any, uomMap: Record<number, string>) => ({
    item_id: String(comp.input_component_id),
    type: comp.item_type,
    quantity: comp.quantity,
    uom_id: comp.uom_id,
    item: {
        id: String(comp.input_component_id),
        code: comp.item_code,
        name: comp.item_name,
        type: comp.item_type,
        uom: resolveUomLabel(uomMap, comp.uom_id, comp.uom, comp.uom_name),
    },
});

const findBomComponentRecordByOptionValue = (records: any[], optionValue: string) =>
    records.find((r, idx) => getBomComponentOptionValue(r, idx) === String(optionValue));

const formatBomSfgFgLabel = (code: string, name: string): string => {
    const trimmedCode = code.trim();
    const trimmedName = name.trim() || "Unknown";
    return trimmedCode ? `${trimmedCode} - ${trimmedName}` : trimmedName;
};

const getBomComponentOptionLabel = (record: any, _index: number): string => {
    const oc = record.output_component || {};
    const code = String(oc.code || "").trim();
    const name = String(oc.name || "Unknown").trim();
    return formatBomSfgFgLabel(code, name);
};

// ============================================================================
// OPERATION FLOW STORAGE (read-only; same key as Production Masters → Operations)
// ============================================================================

const OPERATION_FLOW_MAPPING_STORAGE_KEY = "master-erp-operation-flow-mappings";

interface MappedFlowOperation {
    operation_id: number;
    operation_code: string;
    operation_name: string;
    sequence: number;
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

// ============================================================================
// OPERATION-BASED BOM STRUCTURE (tree builder)
// ============================================================================

interface BomStructureLine {
    item_id: number;
    item_code: string;
    item_name: string;
    type: string;
    uom: string;
    quantity: number | string;
    producedBy?: { code: string; name: string };
    nestedOperation?: BomStructureOperation;
}

interface BomStructureOperation {
    id: number;
    code: string;
    name: string;
    sequence?: number;
    outputs: BomStructureLine[];
    inputs: BomStructureLine[];
}

interface BomOperationTree {
    selectedItemCode: string;
    selectedItemName: string;
    mainOperation: BomStructureOperation;
    childOperations: BomStructureOperation[];
    rootOutputQuantity?: number;
    isGsv7Nested?: boolean;
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

const normalizeBomOperationTypeLabel = (raw?: string): string => {
    const code = String(raw || "").toUpperCase();
    if (code === "RM" || code.includes("RAW")) return "RM";
    if (code === "SFG" || code.includes("SEMI")) return "SFG";
    if (code === "FG" || (code.includes("FINISHED") && !code.includes("SEMI"))) return "FG";
    if (code === "WASTE" || code.includes("WASTE")) return "Waste";
    if (code === "CONS" || code.includes("CONSUM")) return "Consumables";
    return raw ? String(raw) : "RM";
};

const mapOperationLine = (row: any, fallbackType: string): BomStructureLine => {
    const typeRaw =
        row.item_type ??
        row.type ??
        row.item_type_name ??
        row.type_name ??
        row.material_type ??
        fallbackType;
    return {
        item_id: Number(row.item_id ?? row.item?.id ?? 0),
        item_code: String(row.item_code ?? row.item?.code ?? row.material_code ?? "").trim(),
        item_name: String(row.item_name ?? row.item?.name ?? row.material_name ?? "Unknown").trim(),
        type: normalizeBomOperationTypeLabel(String(typeRaw)),
        uom: String(row.uom ?? row.uom_name ?? row.item?.uom ?? row.item?.uom_name ?? "").trim(),
        quantity: Number(row.quantity ?? 1) || 1,
    };
};

const parseOperationDetail = async (operationId: number) => {
    const res = await operationsApi.getOne(operationId);
    if (!res?.isSuccessful) return null;
    const payload = extractOperationPayload(res);
    const op = payload?.operation ?? payload;
    return {
        id: Number(op.id ?? operationId),
        code: String(op.code ?? "").trim(),
        name: String(op.name ?? "").trim(),
        inputs: extractOperationItems(payload, "inputs").map((r: any) => mapOperationLine(r, "RM")),
        outputs: extractOperationItems(payload, "outputs").map((r: any) => mapOperationLine(r, "SFG")),
    };
};

const operationOutputsItem = (outputs: BomStructureLine[], itemId: number) =>
    outputs.some((o) => o.item_id === itemId);

async function findMainOperationId(outputItemId: number, listOperationIds: number[]): Promise<number | null> {
    const flowParents = Object.keys(loadAllOperationFlowMappings())
        .map((k) => Number(k))
        .filter((id) => Number.isFinite(id) && id > 0);

    const candidates = [...new Set([...flowParents, ...listOperationIds])];
    const chunkSize = 6;

    for (let i = 0; i < candidates.length; i += chunkSize) {
        const chunk = candidates.slice(i, i + chunkSize);
        const results = await Promise.all(
            chunk.map(async (id) => {
                const detail = await parseOperationDetail(id);
                if (!detail) return null;
                return operationOutputsItem(detail.outputs, outputItemId) ? detail.id : null;
            }),
        );
        const found = results.find((id) => id != null);
        if (found) return found;
    }
    return null;
}

function applyQuantityOverrides(
    lines: BomStructureLine[],
    qtyByItemId: Record<string, number | string>,
): BomStructureLine[] {
    return lines.map((line) => {
        const key = String(line.item_id);
        if (qtyByItemId[key] !== undefined) {
            return { ...line, quantity: qtyByItemId[key] };
        }
        return line;
    });
}

function attachProducedBy(
    inputs: BomStructureLine[],
    producerByItemId: Map<number, { code: string; name: string }>,
): BomStructureLine[] {
    return inputs.map((input) => {
        const typeKey = input.type.toUpperCase();
        if (typeKey !== "SFG") return input;
        const producer = producerByItemId.get(input.item_id);
        if (!producer) return input;
        return { ...input, producedBy: producer };
    });
}

async function buildBomOperationTree(params: {
    outputItemId: number;
    selectedItemCode: string;
    selectedItemName: string;
    quantityByItemId?: Record<string, number | string>;
}): Promise<BomOperationTree | null> {
    const { outputItemId, selectedItemCode, selectedItemName, quantityByItemId = {} } = params;

    const listRes = await operationsApi.getAll({ page: 1, limit: 500 });
    if (!listRes?.isSuccessful) return null;

    const records = Array.isArray(listRes?.data?.records) ? listRes.data.records : [];
    const listOperationIds = records
        .map((row: any) => {
            const op = row?.operation ?? row;
            return Number(op?.id);
        })
        .filter((id: number) => Number.isFinite(id) && id > 0);

    const mainOpId = await findMainOperationId(outputItemId, listOperationIds);
    if (!mainOpId) return null;

    const mainDetail = await parseOperationDetail(mainOpId);
    if (!mainDetail) return null;

    const flowRows = loadAllOperationFlowMappings()[String(mainOpId)] ?? [];
    const childDetails: BomStructureOperation[] = [];

    for (const flowRow of flowRows) {
        const child = await parseOperationDetail(flowRow.operation_id);
        if (!child) continue;
        childDetails.push({
            id: child.id,
            code: child.code || flowRow.operation_code,
            name: child.name || flowRow.operation_name,
            sequence: flowRow.sequence,
            outputs: applyQuantityOverrides(child.outputs, quantityByItemId),
            inputs: applyQuantityOverrides(child.inputs, quantityByItemId),
        });
    }

    const producerByItemId = new Map<number, { code: string; name: string }>();
    childDetails.forEach((child) => {
        child.outputs.forEach((output) => {
            if (output.item_id > 0) {
                producerByItemId.set(output.item_id, { code: child.code, name: child.name });
            }
        });
    });

    return {
        selectedItemCode,
        selectedItemName,
        mainOperation: {
            id: mainDetail.id,
            code: mainDetail.code,
            name: mainDetail.name,
            outputs: applyQuantityOverrides(mainDetail.outputs, quantityByItemId),
            inputs: attachProducedBy(
                applyQuantityOverrides(mainDetail.inputs, quantityByItemId),
                producerByItemId,
            ),
        },
        childOperations: childDetails,
    };
}

// ============================================================================
// OPERATION-BASED BOM STRUCTURE (view)
// ============================================================================

function bomTypeBadgeClass(type: string) {
    const t = type.toUpperCase();
    if (t === "FG") return "bg-blue-50 text-blue-700 border-blue-200";
    if (t === "SFG") return "bg-purple-50 text-purple-700 border-purple-200";
    if (t === "RM") return "bg-slate-50 text-slate-700 border-slate-200";
    if (t === "WASTE") return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-muted/50 text-muted-foreground border-border";
}

function BomTypeBadge({ type }: { type: string }) {
    return (
        <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase shrink-0", bomTypeBadgeClass(type))}>
            {type}
        </Badge>
    );
}

function BomNestedOperationPanel({
    operation,
    depth = 0,
}: {
    operation: BomStructureOperation;
    depth?: number;
}) {
    return (
        <div
            className={cn(
                "rounded-md border border-dashed border-purple-200 bg-purple-50/40",
                depth > 0 && "ml-3",
            )}
        >
            <div className="border-b border-purple-100 px-3 py-2">
                <p className="text-xs font-semibold text-purple-900">
                    <span className="font-mono">{operation.code}</span>
                    <span className="text-purple-700 font-normal"> · {operation.name}</span>
                </p>
                <p className="text-[10px] text-purple-700/80">Calculated from parent quantity</p>
            </div>
            <div className="space-y-3 p-3">
                <BomSectionBlock
                    title="Output"
                    lines={operation.outputs}
                    renderLine={(line) => (
                        <BomMaterialRow
                            key={`nest-out-${operation.id}-${line.item_id}`}
                            line={line}
                            highlighted
                            disabled
                        />
                    )}
                />
                <BomSectionBlock
                    title="Inputs"
                    lines={operation.inputs}
                    renderLine={(line) => (
                        <div key={`nest-in-${operation.id}-${line.item_id}`} className="space-y-2">
                            <BomMaterialRow line={line} disabled />
                            {line.nestedOperation && (
                                <BomNestedOperationPanel
                                    operation={line.nestedOperation}
                                    depth={depth + 1}
                                />
                            )}
                        </div>
                    )}
                />
            </div>
        </div>
    );
}

function BomMaterialRow({
    line,
    highlighted,
    disabled,
    onQuantityChange,
}: {
    line: BomStructureLine;
    highlighted?: boolean;
    disabled?: boolean;
    onQuantityChange?: (itemId: number, qty: string) => void;
}) {
    const producedByLabel = line.producedBy ? `(made by ${line.producedBy.code})` : null;

    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-2 rounded-md border px-3 py-2.5 sm:grid-cols-[1fr_auto_auto_88px] sm:items-center sm:gap-3",
                highlighted ? "border-blue-200 bg-blue-50/80" : "border-border bg-white",
            )}
        >
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                    {line.item_name}
                    {producedByLabel && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">{producedByLabel}</span>
                    )}
                </p>
                {line.item_code && (
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{line.item_code}</p>
                )}
            </div>
            <div className="flex items-center gap-2 sm:justify-center">
                <BomTypeBadge type={line.type} />
            </div>
            <div className="text-xs text-muted-foreground sm:text-center">
                <span className="sm:hidden font-semibold uppercase text-[10px] mr-1">UOM</span>
                {line.uom || "—"}
            </div>
            <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground sm:hidden">Qty</span>
                <Input
                    type="text"
                    inputMode="decimal"
                    value={String(line.quantity ?? "")}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                            onQuantityChange?.(line.item_id, val);
                        }
                    }}
                    disabled={disabled || !onQuantityChange}
                    className="h-8 w-full max-w-[88px] text-right font-mono text-sm font-semibold"
                />
            </div>
        </div>
    );
}

function BomSectionBlock({
    title,
    lines,
    emptyText,
    renderLine,
}: {
    title: string;
    lines: BomStructureLine[];
    emptyText?: string;
    renderLine: (line: BomStructureLine) => ReactNode;
}) {
    return (
        <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
            {lines.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">{emptyText ?? "None"}</p>
            ) : (
                <div className="space-y-2">{lines.map(renderLine)}</div>
            )}
        </div>
    );
}

function BomOperationCardBody({
    operation,
    disabled,
    onQuantityChange,
    editableOutputItemCode,
    isGsv7Nested,
}: {
    operation: BomStructureOperation;
    disabled?: boolean;
    onQuantityChange?: (itemId: number, qty: string) => void;
    editableOutputItemCode?: string;
    isGsv7Nested?: boolean;
}) {
    const canEditOutput = (line: BomStructureLine) => {
        if (!onQuantityChange || disabled) return false;
        if (!isGsv7Nested) return true;
        if (!editableOutputItemCode) return false;
        return normalizeCode(line.item_code) === normalizeCode(editableOutputItemCode);
    };

    return (
        <div className="space-y-4 p-4">
            <BomSectionBlock
                title="Output"
                lines={operation.outputs}
                renderLine={(line) => (
                    <BomMaterialRow
                        key={`out-${operation.id}-${line.item_id}`}
                        line={line}
                        highlighted
                        disabled={disabled && !canEditOutput(line)}
                        onQuantityChange={canEditOutput(line) ? onQuantityChange : undefined}
                    />
                )}
            />
            <BomSectionBlock
                title="Inputs"
                lines={operation.inputs}
                emptyText="No inputs defined for this operation."
                renderLine={(line) => (
                    <div key={`in-${operation.id}-${line.item_id}`} className="space-y-2">
                        <BomMaterialRow
                            line={line}
                            disabled={disabled || isGsv7Nested}
                            onQuantityChange={isGsv7Nested ? undefined : onQuantityChange}
                        />
                        {line.nestedOperation && (
                            <BomNestedOperationPanel operation={line.nestedOperation} />
                        )}
                    </div>
                )}
            />
        </div>
    );
}

function normalizeCode(code: string) {
    return String(code ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function BomMainOperationCard({
    operation,
    disabled,
    onQuantityChange,
    editableOutputItemCode,
    isGsv7Nested,
}: {
    operation: BomStructureOperation;
    disabled?: boolean;
    onQuantityChange?: (itemId: number, qty: string) => void;
    editableOutputItemCode?: string;
    isGsv7Nested?: boolean;
}) {
    return (
        <div className="rounded-lg border border-border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                        <span className="font-mono">{operation.code}</span>
                        <span className="text-muted-foreground font-normal"> · </span>
                        {operation.name}
                    </p>
                </div>
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] shrink-0">Main assembly</Badge>
            </div>
            <BomOperationCardBody
                operation={operation}
                disabled={disabled}
                onQuantityChange={onQuantityChange}
                editableOutputItemCode={editableOutputItemCode}
                isGsv7Nested={isGsv7Nested}
            />
        </div>
    );
}

function BomChildOperationCard({
    operation,
    disabled,
    onQuantityChange,
}: {
    operation: BomStructureOperation;
    disabled?: boolean;
    onQuantityChange?: (itemId: number, qty: string) => void;
}) {
    const [open, setOpen] = useState(true);

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown
                        className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                    />
                    <p className="text-sm font-bold text-foreground truncate">
                        <span className="font-mono">{operation.code}</span>
                        <span className="text-muted-foreground font-normal"> · </span>
                        {operation.name}
                    </p>
                </CollapsibleTrigger>
                {operation.sequence != null && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                        Step {operation.sequence}
                    </Badge>
                )}
            </div>
            <CollapsibleContent>
                <BomOperationCardBody operation={operation} disabled={disabled} onQuantityChange={onQuantityChange} />
            </CollapsibleContent>
        </Collapsible>
    );
}

function BomOperationStructureView({
    tree,
    isLoading,
    hasSelectedItem,
    selectedItemLabel,
    disabled,
    onQuantityChange,
}: {
    tree: BomOperationTree | null;
    isLoading: boolean;
    hasSelectedItem: boolean;
    selectedItemLabel?: string;
    disabled?: boolean;
    onQuantityChange?: (itemId: number, qty: string) => void;
}) {
    const isGsv7Nested = tree?.isGsv7Nested === true;
    return (
        <div className="space-y-3">
            <Label className="text-xs font-bold text-primary uppercase border-b pb-1 block">
                Operation-Based BOM Structure
            </Label>

            {hasSelectedItem && selectedItemLabel && !isLoading && tree && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <span className="font-semibold">{selectedItemLabel}</span>
                    <span className="text-blue-700">
                        {isGsv7Nested
                            ? " · set output quantity below; nested operations calculate automatically"
                            : " selected · operations loaded below"}
                    </span>
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 bg-muted/5 rounded-lg border-2 border-dashed gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading operation structure...</p>
                </div>
            ) : !hasSelectedItem ? (
                <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/5">
                    <p className="text-sm text-muted-foreground">Select an SFG/FG to view the manufacturing tree</p>
                </div>
            ) : !tree ? (
                <div className="text-center py-10 border-2 border-dashed rounded-lg bg-amber-50/50 border-amber-200">
                    <p className="text-sm text-amber-900 font-medium">No operation flow found for this item</p>
                    <p className="text-xs text-muted-foreground mt-1 px-4">
                        Ensure an operation outputs this item and configure Operation Flow Mapping in Production
                        Masters → Operations.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <BomMainOperationCard
                        operation={tree.mainOperation}
                        disabled={disabled}
                        onQuantityChange={onQuantityChange}
                        editableOutputItemCode={tree.selectedItemCode}
                        isGsv7Nested={isGsv7Nested}
                    />
                    {!isGsv7Nested && tree.childOperations.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground">
                                Mini operations — they make the SFG inputs above
                            </p>
                            {tree.childOperations.map((child) => (
                                <BomChildOperationCard
                                    key={child.id}
                                    operation={child}
                                    disabled={disabled}
                                    onQuantityChange={onQuantityChange}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface BOM2Record {
    id: number;
    bomCode: string;
    bomName: string;
    itemType: "FG" | "SFG";
    itemName: string;
    description?: string;
    status: "Active" | "Inactive";
    createdAt: string;
    components: any[];
    itemId?: number;
}

interface BOMComponent {
    item_id: string;
    type: string;
    quantity: number | string;
    item?: {
        id: string;
        code: string;
        name: string;
        type: string;
        uom: string;
    };
}

interface BOMFormData {
    id?: number;
    bomCode?: string;
    bomName: string;
    bomDescription: string;
    selectedItemId: string;
    selectedSkuId: string;
    components: BOMComponent[];
}

export default function BOM() {
    const { isMenuVisible, canCreate, canEdit, canDelete, canView } = useHasPermission();
    const permissionModule = "PRODUCTION/BOM";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();

    // Listing State
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [typeFilter, setTypeFilter] = useState("All");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    // Pagination state - using DataTablePagination component
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [bomRecords, setBomRecords] = useState<BOM2Record[]>([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [bomComponentRecords, setBomComponentRecords] = useState<any[]>(() =>
        BOM_SFG_FG_MOCK_DROPDOWN_ONLY ? getAllGsv7BomComponentRecords() : [],
    );

    /** Records used for SFG/FG dropdown and BOM create resolution (mock catalog when enabled). */
    const sfgFgDropdownRecords = useMemo(() => {
        if (BOM_SFG_FG_MOCK_DROPDOWN_ONLY) {
            return getAllGsv7BomComponentRecords();
        }
        return bomComponentRecords;
    }, [bomComponentRecords]);
    const [totalRecords, setTotalRecords] = useState(0);
    
    // Master Data from Global Store (Loaded at login)
    const itemTypes = useCommonStore(state => state.itemTypes);
    const uoms = useCommonStore(state => state.uoms);

    // Derived Master Data Mappings - No hardcoded IDs or names
    const uomMap = useMemo(() => buildUomMap(uoms), [uoms]);

    const fgTypeId = useMemo(() => {
        // Dynamically find FG using value_code (per user requirement)
        const match = itemTypes.find(t => 
            String(t.value_code || t.code).toUpperCase() === "FG"
        );
        return match?.id ? Number(match.id) : undefined;
    }, [itemTypes]);

    const sfgTypeId = useMemo(() => {
        // Dynamically find SFG using value_code (per user requirement)
        const match = itemTypes.find(t => 
            String(t.value_code || t.code).toUpperCase() === "SFG"
        );
        return match?.id ? Number(match.id) : undefined;
    }, [itemTypes]);

    // Dialog State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"create" | "view" | "edit">("view");
    const [formData, setFormData] = useState<BOMFormData>({
        bomName: "",
        bomDescription: "",
        selectedItemId: "",
        selectedSkuId: "",
        components: []
    });
    const [skuRecords, setSkuRecords] = useState<SkuRecord[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [openingBOMId, setOpeningBOMId] = useState<number | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [bomNameError, setBomNameError] = useState("");
    const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null);
    const [operationTree, setOperationTree] = useState<BomOperationTree | null>(null);
    const [isOperationTreeLoading, setIsOperationTreeLoading] = useState(false);

    const handleCreateClick = () => {
        if (openingBOMId !== null) return;

        setDialogMode("create");
        setBomNameError("");
        setFormData({
            bomName: "",
            bomDescription: "",
            selectedItemId: "",
            selectedSkuId: "",
            components: []
        });
        setOperationTree(null);
        fetchBOMComponents();
        loadSkuRecords();
        setDialogOpen(true);
    };

    const loadSkuRecords = useCallback(() => {
        try {
            setSkuRecords(loadProcurementSkuRecords());
        } catch {
            setSkuRecords([]);
        }
    }, []);

    const handleEditClick = async (record: BOM2Record) => {
        if (openingBOMId !== null) return;

        setOpeningBOMId(record.id);
        setDialogMode("edit");
        setBomNameError("");
        setDialogOpen(true);
        setIsDetailLoading(true);
        void fetchBOMComponents();
        loadSkuRecords();
        try {
            const response = await productionApi.getBOMDetail(record.id);
            if (response.isSuccessful && response.data) {
                const detail = response.data;
                setFormData({
                    id: detail.id,
                    bomCode: detail.bom_code,
                    bomName: detail.bom_name,
                    bomDescription: detail.description || "",
                    selectedItemId: String(detail.item_id || record.itemId || ""),
                    selectedSkuId: "",
                    components: (detail.components || []).map((comp: any) =>
                        mapBomDetailComponent(comp, uomMap)
                    )
                });
            }
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to fetch BOM details", variant: "destructive" });
        } finally {
            setIsDetailLoading(false);
            setOpeningBOMId(null);
        }
    };

    const handleViewClick = async (record: BOM2Record) => {
        if (openingBOMId !== null) return;

        setOpeningBOMId(record.id);
        setDialogMode("view");
        setBomNameError("");
        setDialogOpen(true);
        setIsDetailLoading(true);
        void fetchBOMComponents();
        loadSkuRecords();
        try {
            const response = await productionApi.getBOMDetail(record.id);
            if (response.isSuccessful && response.data) {
                const detail = response.data;
                setFormData({
                    bomCode: detail.bom_code,
                    bomName: detail.bom_name,
                    bomDescription: detail.description || "",
                    selectedItemId: String(detail.item_id || record.itemId || ""),
                    selectedSkuId: "",
                    components: (detail.components || []).map((comp: any) =>
                        mapBomDetailComponent(comp, uomMap)
                    )
                });
            }
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to fetch BOM details", variant: "destructive" });
        } finally {
            setIsDetailLoading(false);
            setOpeningBOMId(null);
        }
    };

    // Auto-population logic from getbomcomponents API
    useEffect(() => {
        if (dialogMode === "create" && formData.selectedItemId) {
            const outputRecord = findBomComponentRecordByOptionValue(
                sfgFgDropdownRecords,
                formData.selectedItemId
            );

            if (outputRecord && outputRecord.input_components) {
                const components = outputRecord.input_components.map((input: any) => ({
                    item_id: String(input.item_id),
                    type: input.item_type,
                    quantity: 1, // Default quantity
                    uom_id: input.uom_id,
                    item: {
                        id: String(input.item_id),
                        code: input.item_code,
                        name: input.item_name,
                        type: input.item_type,
                        uom: resolveUomLabel(uomMap, input.uom_id, input.uom, input.uom_name),
                    },
                }));
                setFormData((prev: BOMFormData) => ({ ...prev, components }));
            } else {
                setFormData((prev: BOMFormData) => ({ ...prev, components: [] }));
            }
        }
    }, [formData.selectedItemId, dialogMode, sfgFgDropdownRecords, uomMap]);

    const quantityByItemId = useMemo(() => {
        const map: Record<string, number | string> = {};
        formData.components.forEach((c) => {
            map[String(c.item_id)] = c.quantity;
        });
        return map;
    }, [formData.components]);

    const resolveSelectedOutputItem = useMemo(() => {
        if (!formData.selectedItemId) return null;

        const outputRecord = findBomComponentRecordByOptionValue(
            sfgFgDropdownRecords,
            formData.selectedItemId,
        );
        if (outputRecord?.output_component) {
            const oc = outputRecord.output_component;
            const code = String(oc.code ?? oc.item_code ?? "").trim();
            return {
                id: Number(oc.id),
                code,
                name: String(oc.name ?? oc.item_name ?? "Unknown").trim(),
            };
        }

        const directId = Number(formData.selectedItemId);
        if (Number.isFinite(directId) && directId > 0) {
            const bomMatch = bomRecords.find((b) => Number(b.itemId) === directId);
            return {
                id: directId,
                code: bomMatch?.bomCode ?? "",
                name: bomMatch?.itemName ?? "Selected item",
            };
        }
        return null;
    }, [formData.selectedItemId, sfgFgDropdownRecords, bomRecords]);

    const selectedItemBannerLabel = resolveSelectedOutputItem
        ? formatBomSfgFgLabel(resolveSelectedOutputItem.code, resolveSelectedOutputItem.name)
        : undefined;

    const filteredSkuDropdownOptions = useMemo(() => {
        const itemId = resolveSelectedOutputItem?.id;
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
    }, [skuRecords, resolveSelectedOutputItem?.id]);

    useEffect(() => {
        if (!dialogOpen || !resolveSelectedOutputItem?.code) {
            setOperationTree(null);
            setIsOperationTreeLoading(false);
            return;
        }

        const itemCode = resolveSelectedOutputItem.code;

        if (isGsv7CatalogItemCode(itemCode)) {
            let cancelled = false;
            setIsOperationTreeLoading(true);
            const rootItemId = getGsv7ItemIdByCode(itemCode);
            const rootQty = Number(quantityByItemId[String(rootItemId)]) || 1;
            const gsv7Tree = buildGsv7NestedBomTree(itemCode, rootQty);
            if (!cancelled) {
                if (gsv7Tree) {
                    setOperationTree({
                        ...gsv7Tree,
                        isGsv7Nested: true,
                        rootOutputQuantity: rootQty,
                    });
                    setFormData((prev) => ({
                        ...prev,
                        components: gsv7TreeToTopLevelComponents(gsv7Tree),
                    }));
                } else {
                    setOperationTree(null);
                }
                setIsOperationTreeLoading(false);
            }
            return () => {
                cancelled = true;
            };
        }

        if (!resolveSelectedOutputItem.id || resolveSelectedOutputItem.id <= 0) {
            setOperationTree(null);
            setIsOperationTreeLoading(false);
            return;
        }

        let cancelled = false;
        setIsOperationTreeLoading(true);

        buildBomOperationTree({
            outputItemId: resolveSelectedOutputItem.id,
            selectedItemCode: resolveSelectedOutputItem.code,
            selectedItemName: resolveSelectedOutputItem.name,
            quantityByItemId,
        })
            .then((tree) => {
                if (!cancelled) setOperationTree(tree);
            })
            .catch((err) => {
                console.error("Failed to build BOM operation tree:", err);
                if (!cancelled) setOperationTree(null);
            })
            .finally(() => {
                if (!cancelled) setIsOperationTreeLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [dialogOpen, resolveSelectedOutputItem?.code, resolveSelectedOutputItem?.id]);

    useEffect(() => {
        if (!operationTree || formData.components.length === 0) return;
        setOperationTree((prev) => {
            if (!prev) return prev;
            const applyQty = (lines: typeof prev.mainOperation.inputs) =>
                lines.map((line) => {
                    const q = quantityByItemId[String(line.item_id)];
                    return q !== undefined ? { ...line, quantity: q } : line;
                });
            return {
                ...prev,
                mainOperation: {
                    ...prev.mainOperation,
                    outputs: applyQty(prev.mainOperation.outputs),
                    inputs: applyQty(prev.mainOperation.inputs),
                },
                childOperations: prev.childOperations.map((child) => ({
                    ...child,
                    outputs: applyQty(child.outputs),
                    inputs: applyQty(child.inputs),
                })),
            };
        });
    }, [formData.components.length, formData.selectedItemId]);

    const handleStructureQuantityChange = (itemId: number, qty: string) => {
        const itemCode = resolveSelectedOutputItem?.code;
        if (itemCode && isGsv7CatalogItemCode(itemCode)) {
            const rootItemId = getGsv7ItemIdByCode(itemCode);
            if (itemId !== rootItemId) return;

            const rootQty = Number(qty) || 1;
            const gsv7Tree = buildGsv7NestedBomTree(itemCode, rootQty);
            if (!gsv7Tree) return;

            setOperationTree({
                ...gsv7Tree,
                isGsv7Nested: true,
                rootOutputQuantity: rootQty,
            });
            setFormData((prev) => ({
                ...prev,
                components: gsv7TreeToTopLevelComponents(gsv7Tree),
            }));
            return;
        }

        setFormData((prev) => {
            const idx = prev.components.findIndex((c) => Number(c.item_id) === itemId);
            if (idx < 0) return prev;
            const components = [...prev.components];
            components[idx] = { ...components[idx], quantity: qty };
            return { ...prev, components };
        });

        setOperationTree((prev) => {
            if (!prev) return prev;
            const patchLines = (lines: BomOperationTree["mainOperation"]["inputs"]) =>
                lines.map((line) => (line.item_id === itemId ? { ...line, quantity: qty } : line));
            return {
                ...prev,
                mainOperation: {
                    ...prev.mainOperation,
                    outputs: patchLines(prev.mainOperation.outputs),
                    inputs: patchLines(prev.mainOperation.inputs),
                },
                childOperations: prev.childOperations.map((child) => ({
                    ...child,
                    outputs: patchLines(child.outputs),
                    inputs: patchLines(child.inputs),
                })),
            };
        });
    };

    // Re-resolve UOM labels when master UOM data loads after BOM detail fetch
    useEffect(() => {
        if (!dialogOpen || uoms.length === 0) return;
        setFormData((prev) => {
            if (!prev.components?.length) return prev;
            let changed = false;
            const components = prev.components.map((comp: any) => {
                const resolved = resolveUomLabel(uomMap, comp.uom_id, comp.item?.uom);
                if (resolved && resolved !== comp.item?.uom) {
                    changed = true;
                    return { ...comp, item: { ...comp.item, uom: resolved } };
                }
                return comp;
            });
            return changed ? { ...prev, components } : prev;
        });
    }, [dialogOpen, uoms, uomMap]);

    const handleSave = async () => {
        if (isSaving) return;

        const nameTrimmed = formData.bomName.trim();
        if (
            nameTrimmed.length < BOM_NAME_MIN_LEN ||
            nameTrimmed.length > BOM_NAME_MAX_LEN
        ) {
            if (nameTrimmed.length > 0 && nameTrimmed.length < BOM_NAME_MIN_LEN) {
                setBomNameError("Minimum 2 characters required");
            } else {
                setBomNameError("");
            }
            toast({
                title: "Validation Error",
                description: `BOM name must be between ${BOM_NAME_MIN_LEN} and ${BOM_NAME_MAX_LEN} characters.`,
                variant: "destructive",
            });
            return;
        }
        if (!formData.selectedItemId) {
            toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
            return;
        }

        if (dialogMode === "create") {
            setIsSaving(true);
            try {
                const outputRecord = findBomComponentRecordByOptionValue(
                    sfgFgDropdownRecords,
                    formData.selectedItemId
                );

                // Dynamically resolve item_type_id using master data from store
                // We determine if it's SFG or FG based on the item name or record data
                const isSFG = outputRecord?.output_component?.name?.toLowerCase().includes("sfg") || 
                              outputRecord?.output_component?.name?.toLowerCase().includes("semi");
                
                const itemTypeId = isSFG ? (sfgTypeId || 2) : (fgTypeId || 1);

                const itemId = Number(outputRecord?.output_component?.id);
                const response = await productionApi.createBOM({
                    bom_name: nameTrimmed,
                    item_id: itemId,
                    item_type_id: itemTypeId,
                    description: formData.bomDescription,
                    components: formData.components.map((c: any) => ({
                        input_component_id: Number(c.item_id),
                        quantity: Number(c.quantity)
                    })),
                });

                if (response.isSuccessful) {
                    toast({
                        variant: "success",
                        title: "Success",
                        description: response.message || "BOM created successfully",
                    });
                    setDialogOpen(false);
                    if (typeof fetchBOMList === 'function') fetchBOMList();
                }
            } catch (error: any) {
                toast({
                    title: "Error",
                    description: error.message || "Failed to create BOM",
                    variant: "destructive",
                });
            } finally {
                setIsSaving(false);
            }
        } else if (dialogMode === "edit" && formData.id) {
            setIsSaving(true);
            try {
                const response = await productionApi.updateBOM(formData.id, {
                    bom_name: nameTrimmed,
                    description: formData.bomDescription,
                    components: formData.components.map((c: any) => ({
                        input_component_id: Number(c.item_id),
                        quantity: Number(c.quantity)
                    }))
                });

                if (response.isSuccessful) {
                    toast({
                        variant: "success",
                        title: "Updated",
                        description: response.message || "BOM updated successfully",
                    });
                    setDialogOpen(false);
                    fetchBOMList();
                }
            } catch (error: any) {
                toast({
                    title: "Error",
                    description: error.message || "Failed to update BOM",
                    variant: "destructive",
                });
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleDelete = async () => {
        if (!formData.id || isSaving) return;

        setIsSaving(true);
        try {
            const response = await productionApi.deleteBOM(formData.id);
            if (response.isSuccessful) {
                toast({
                    variant: "success",
                    title: "Deleted",
                    description: response.message || "BOM record removed",
                });
                setDialogOpen(false);
                setIsDeleteDialogOpen(false);
                fetchBOMList();
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete BOM",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const fetchBOMList = async () => {
        setIsListLoading(true);
        try {
            const formattedDate = dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined;
            
            const itemTypeIdForFilter = typeFilter === "FG" ? fgTypeId : (typeFilter === "SFG" ? sfgTypeId : undefined);

            const response = await productionApi.getBOMList({
                search: debouncedSearchTerm,
                item_type_id: itemTypeIdForFilter,
                created_at: formattedDate,
                page: currentPage,
                limit: itemsPerPage
            });

            if (response.isSuccessful && response.data) {
                const records = response.data.records || [];
                const mappedRecords: BOM2Record[] = records.map((rec: any) => ({
                    id: rec.id,
                    bomCode: rec.bom_code || "N/A",
                    bomName: rec.bom_name || "N/A",
                    itemType: (rec.item_type || "FG") as "FG" | "SFG",
                    itemName: rec.item_name || "N/A",
                    itemId: rec.item_id,
                    createdAt: rec.creaed_at || rec.created_at || "", 
                    status: "Active",
                    components: []
                }));
                setBomRecords(mappedRecords);
                setTotalRecords(response.data.pagination?.totalRecords || 0);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to fetch BOM list",
                variant: "destructive",
            });
        } finally {
            setIsListLoading(false);
        }
    };

    const fetchBOMComponents = async () => {
        if (BOM_SFG_FG_MOCK_DROPDOWN_ONLY) {
            setBomComponentRecords(getAllGsv7BomComponentRecords());
            return;
        }
        try {
            const response = await commonApi.getBOMComponents();
            if (response.isSuccessful && response.data) {
                const apiRecords = response.data.records || [];
                const apiCodes = new Set(
                    apiRecords.map((r: { output_component?: { code?: string } }) =>
                        normalizeCode(String(r.output_component?.code ?? "")),
                    ),
                );
                const gsv7Records = getAllGsv7BomComponentRecords().filter(
                    (r) => !apiCodes.has(normalizeCode(r.output_component.code)),
                );
                setBomComponentRecords([...gsv7Records, ...apiRecords]);
            } else {
                setBomComponentRecords(getAllGsv7BomComponentRecords());
            }
        } catch (error: any) {
            console.error("Failed to fetch BOM components:", error);
            setBomComponentRecords(getAllGsv7BomComponentRecords());
        }
    };

    useEffect(() => {
        fetchBOMList();
    }, [debouncedSearchTerm, typeFilter, dateFilter, currentPage, itemsPerPage, fgTypeId, sfgTypeId]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, typeFilter, dateFilter]);

    const totalPages = Math.ceil(totalRecords / itemsPerPage);

    const bomNameTrimLen = formData.bomName.trim().length;
    const canSaveBom =
        !isSaving &&
        !isDetailLoading &&
        bomNameTrimLen >= BOM_NAME_MIN_LEN &&
        bomNameTrimLen <= BOM_NAME_MAX_LEN &&
        Boolean(formData.selectedItemId) &&
        formData.components.length > 0 &&
        !formData.components.some((c: any) => c.quantity < 0 || c.quantity > 1000000);

    const isRowActionBusy = openingBOMId !== null || isSaving;

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">BOM Management</h1>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by Code, Name or Item..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Type',
                        value: typeFilter,
                        options: [
                            { label: "All Type", value: "All" },
                            ...itemTypes
                                .filter(t => ["FG", "SFG"].includes(String(t.value_code || t.code).toUpperCase()))
                                .map(t => ({
                                    label: t.value_name || t.name,
                                    value: String(t.value_code || t.code).toUpperCase()
                                }))
                        ],
                        onChange: setTypeFilter,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter,
                        onChange: setDateFilter,
                        showClear: !!dateFilter
                    }
                ]}
                actions={[
                    ...(canCreate(permissionModule) ? [{
                        label: "Create BOM",
                        icon: <Plus className="h-4 w-4" />,
                        onClick: handleCreateClick,
                    }] : [])
                ]}
            />

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>BOM Code</TableHead>
                                    <TableHead>BOM Name</TableHead>
                                    <TableHead>FG / SFG</TableHead>
                                    <TableHead>Created On</TableHead>
                                    <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : bomRecords.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            No BOM records found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    bomRecords.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/30">
                                            <TableCell className="font-mono text-xs font-medium">{item.bomCode}</TableCell>
                                            <TableCell className="text-sm font-semibold">{item.bomName}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={item.itemType === 'FG' ? "default" : "secondary"}>
                                                        {item.itemType}
                                                    </Badge>
                                                    <span className="text-xs">{item.itemName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className={cn(isRowActionBusy && "pointer-events-none opacity-50")}>
                                                    <TableActionButtons
                                                        onView={canView(permissionModule) ? () => handleViewClick(item) : undefined}
                                                        onEdit={canEdit(permissionModule) ? () => handleEditClick(item) : undefined}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination - using standardized DataTablePagination component */}
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalRecords}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        options={[10, 15, 30, 50]}
                    />
                </CardContent>
            </Card>

            {/* Dialog Form */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent
                    ref={setDialogEl}
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-4xl xl:max-w-4xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="text-lg font-bold tracking-tight sm:text-xl">
                            {dialogMode === "create" ? "Create New BOM" : dialogMode === "edit" ? "Edit BOM" : "BOM Details"}
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
                            Manage Bill of Materials configuration and component requirements.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        <div className="grid gap-6">
                            {/* Section: Basic Details */}
                            <div className="grid grid-cols-1 gap-4">
                            <div className="min-w-0 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BOM Name *</Label>
                                <Input
                                    placeholder="Enter BOM Name"
                                    value={formData.bomName}
                                    maxLength={BOM_NAME_MAX_LEN}
                                    onChange={(e) => {
                                        const v = e.target.value.slice(0, BOM_NAME_MAX_LEN);
                                        setFormData((prev: BOMFormData) => ({
                                            ...prev,
                                            bomName: v,
                                        }));
                                        const t = v.trim();
                                        if (t.length > 0 && t.length < BOM_NAME_MIN_LEN) {
                                            setBomNameError("Minimum 2 characters required");
                                        } else {
                                            setBomNameError("");
                                        }
                                    }}
                                    className={cn(
                                        "h-9",
                                        bomNameError && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                    disabled={dialogMode === "view"}
                                />
                                {bomNameError && dialogMode !== "view" && (
                                    <p className="mt-1 text-xs text-red-500">{bomNameError}</p>
                                )}
                            </div>
                            <div className="min-w-0 w-full">
                            <SharedSearchableSelect
                                label="SFG / FG *"
                                className="w-full"
                                value={formData.selectedItemId}
                                options={(sfgFgDropdownRecords || []).map((r, index) => {
                                    const oc = r.output_component || {};
                                    const code = String(
                                        oc.code || oc.item_code || oc.output_component_code || oc.component_code || "",
                                    ).trim();
                                    const name = String(
                                        oc.name || oc.item_name || oc.output_component_name || oc.component_name || "Unknown",
                                    ).trim();
                                    const outputId = r.output_component?.id;
                                    const isAlreadyCreated =
                                        !BOM_SFG_FG_MOCK_DROPDOWN_ONLY &&
                                        dialogMode === "create" &&
                                        bomRecords.some(
                                            (bom) => Number(bom.itemId) === Number(outputId),
                                        );
                                    const displayLabel = formatBomSfgFgLabel(code, name);

                                    return {
                                        value: getBomComponentOptionValue(r, index),
                                        label: displayLabel,
                                        primaryText: name,
                                        secondaryText: code || undefined,
                                        disabled: isAlreadyCreated,
                                    };
                                })}
                                onChange={(val) =>
                                    setFormData((prev: BOMFormData) => ({
                                        ...prev,
                                        selectedItemId: val,
                                        selectedSkuId: "",
                                    }))
                                }
                                disabled={dialogMode !== "create"}
                                selectedTruncate="end"
                                popoverCollisionBoundary={dialogEl}
                                popoverCollisionPadding={8}
                                listClassName="max-h-[200px]"
                            />
                            </div>

                            <div className="min-w-0 w-full">
                                <SharedSearchableSelect
                                    label="SKU"
                                    className="w-full"
                                    value={formData.selectedSkuId || undefined}
                                    options={filteredSkuDropdownOptions}
                                    placeholder={
                                        !resolveSelectedOutputItem
                                            ? "Select SFG / FG first"
                                            : filteredSkuDropdownOptions.length === 0
                                              ? "No SKUs for this item"
                                              : "Select SKU"
                                    }
                                    onChange={(val) => {
                                        const s = String(val ?? "").trim();
                                        const skuId = s.includes("|")
                                            ? String(s.split("|").pop() ?? "").trim()
                                            : s;
                                        setFormData((prev: BOMFormData) => ({
                                            ...prev,
                                            selectedSkuId: skuId,
                                        }));
                                    }}
                                    disabled={
                                        dialogMode === "view" ||
                                        !resolveSelectedOutputItem ||
                                        filteredSkuDropdownOptions.length === 0
                                    }
                                    selectedTruncate="end"
                                    popoverCollisionBoundary={dialogEl}
                                    popoverCollisionPadding={8}
                                    listClassName="max-h-[200px]"
                                />
                            </div>

                            <div className="min-w-0 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                                <Input
                                    placeholder="Enter Description"
                                    value={formData.bomDescription}
                                    maxLength={BOM_DESC_MAX_LEN}
                                    onChange={(e) => {
                                        const v = e.target.value.slice(0, BOM_DESC_MAX_LEN);
                                        setFormData((prev: BOMFormData) => ({ ...prev, bomDescription: v }));
                                    }}
                                    disabled={dialogMode === "view"}
                                />
                            </div>
                        </div>

                        <BomOperationStructureView
                            tree={operationTree}
                            isLoading={isDetailLoading || isOperationTreeLoading}
                            hasSelectedItem={Boolean(formData.selectedItemId)}
                            selectedItemLabel={selectedItemBannerLabel}
                            disabled={dialogMode === "view"}
                            onQuantityChange={
                                dialogMode === "view" ? undefined : handleStructureQuantityChange
                            }
                        />
                    </div>
                    </div>

                    <DialogFooter className="shrink-0 items-center justify-between border-t bg-background px-4 pb-4 pt-3 sm:px-5">
                        <div>
                            {dialogMode === "edit" && canDelete(permissionModule) && (
                                <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)} disabled={isSaving || isDetailLoading} className="gap-2">
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {dialogMode === "view" ? "Close" : "Cancel"}
                            </Button>
                            {dialogMode !== "view" && (
                                <Button
                                    onClick={handleSave}
                                    loading={isSaving}
                                    disabled={!canSaveBom}
                                    className={
                                        canSaveBom
                                            ? "bg-blue-600 hover:bg-blue-600/90 text-white border-blue-600"
                                            : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:opacity-100!"
                                    }
                                >
                                    {dialogMode === "create" ? "Save BOM" : "Update Changes"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete BOM</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this BOM? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
