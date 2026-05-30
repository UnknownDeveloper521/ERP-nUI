import { useState, useEffect, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { commonApi, operationsApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { GSV7_ITEMS, getGsv7DemoOperationOptions, getGsv7ItemIdByCode } from "@/lib/gsv7OperationsMockData";
import {
    deleteSkuOperationMapping,
    getSkuOperationMapping,
    listSkuOperationMappings,
    saveSkuOperationMapping,
    skuOperationMappingKey,
    withSkuOperationSequences,
    type SkuMappedOperation,
    type SkuOperationMappingRecord,
} from "@/lib/skuOperationMappingStorage";
import { loadProcurementSkuRecords, type SkuRecord } from "@/pages/masters/ProcurementSkuTab";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

interface OperationOption {
    id: number;
    code: string;
    name: string;
}

interface FgOption {
    id: number;
    code: string;
    name: string;
}

function normalizeOpCode(code: string) {
    return String(code ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function mergeOperationOptions(
    apiOptions: OperationOption[],
    demoOptions: { id: number; code: string; name: string }[],
): OperationOption[] {
    const apiCodes = new Set(apiOptions.map((o) => normalizeOpCode(o.code)));
    const extra = demoOptions.filter((d) => !apiCodes.has(normalizeOpCode(d.code)));
    return [...apiOptions, ...extra];
}

/** Command may pass composite value; keep only the operation id segment. */
function coerceSelectValue(val: string | number): string {
    const s = String(val ?? "").trim();
    if (!s) return "";
    if (s.includes("|")) {
        const parts = s.split("|");
        return String(parts[parts.length - 1] ?? "").trim();
    }
    return s;
}

interface ProductionSkuOperationTabProps {
    canEdit: boolean;
    canDelete?: boolean;
}

export function ProductionSkuOperationTab({ canEdit, canDelete = canEdit }: ProductionSkuOperationTabProps) {
    const { toast } = useToast();
    const itemTypes = useCommonStore((state) => state.itemTypes);

    const fgTypeId = useMemo(() => {
        const match = itemTypes.find(
            (t: { value_code?: string; code?: string }) =>
                String(t.value_code || t.code).toUpperCase() === "FG",
        );
        return match?.id != null ? Number(match.id) : undefined;
    }, [itemTypes]);

    const sfgTypeId = useMemo(() => {
        const match = itemTypes.find(
            (t: { value_code?: string; code?: string }) =>
                String(t.value_code || t.code).toUpperCase() === "SFG",
        );
        return match?.id != null ? Number(match.id) : undefined;
    }, [itemTypes]);

    const [fgOptions, setFgOptions] = useState<FgOption[]>([]);
    const [skuRecords, setSkuRecords] = useState<SkuRecord[]>([]);
    const [operationOptions, setOperationOptions] = useState<OperationOption[]>([]);
    const [mappingList, setMappingList] = useState<SkuOperationMappingRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    const [selectedFgId, setSelectedFgId] = useState<string>("");
    const [selectedSkuId, setSelectedSkuId] = useState<string>("");
    const [selectedOperationId, setSelectedOperationId] = useState<string>("");
    const [sequenceRows, setSequenceRows] = useState<SkuMappedOperation[]>([]);
    const [activeMappingKey, setActiveMappingKey] = useState<string | null>(null);
    const [showConfigureForm, setShowConfigureForm] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");

    const [isLoadingFg, setIsLoadingFg] = useState(false);
    const [isLoadingOps, setIsLoadingOps] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [mappingToDelete, setMappingToDelete] = useState<SkuOperationMappingRecord | null>(null);
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

    const refreshMappingList = useCallback(() => {
        setMappingList(listSkuOperationMappings());
    }, []);

    const loadFgOptions = useCallback(async () => {
        setIsLoadingFg(true);
        try {
            const mapDropdownResponse = (res: Awaited<ReturnType<typeof commonApi.getItemsDropdown>>) => {
                const records = Array.isArray(res?.data?.records)
                    ? res.data.records
                    : Array.isArray(res?.data)
                      ? res.data
                      : [];
                return records
                    .map((row: { item?: unknown } | Record<string, unknown>) => {
                        const item = (row as { item?: Record<string, unknown> }).item ?? row;
                        const r = item as Record<string, unknown>;
                        return {
                            id: Number(r.id ?? r.item_id),
                            code: String(r.code ?? r.item_code ?? "").trim(),
                            name: String(r.name ?? r.item_name ?? "").trim(),
                        };
                    })
                    .filter((o) => Number.isFinite(o.id) && o.id > 0 && o.code && o.name);
            };

            const typeIds = [fgTypeId, sfgTypeId].filter(
                (id): id is number => id != null && Number.isFinite(id),
            );
            const fetchLists =
                typeIds.length > 0
                    ? await Promise.all(
                          typeIds.map((item_type_id) =>
                              commonApi.getItemsDropdown({ status: 1, item_type_id }),
                          ),
                      )
                    : [await commonApi.getItemsDropdown({ status: 1 })];

            const byId = new Map<number, FgOption>();
            for (const res of fetchLists) {
                for (const row of mapDropdownResponse(res)) {
                    byId.set(row.id, row);
                }
            }

            const gsv7FgSfg: FgOption[] = Object.values(GSV7_ITEMS)
                .filter((item) => item.type === "FG" || item.type === "SFG")
                .map((item) => ({
                    id: getGsv7ItemIdByCode(item.code),
                    code: item.code,
                    name: item.name,
                }));

            for (const demo of gsv7FgSfg) {
                const exists = [...byId.values()].some(
                    (m) => normalizeOpCode(m.code) === normalizeOpCode(demo.code),
                );
                if (!exists) byId.set(demo.id, demo);
            }

            const merged = [...byId.values()].sort((a, b) =>
                a.code.localeCompare(b.code, undefined, { sensitivity: "base" }),
            );
            setFgOptions(merged);
        } catch (e) {
            console.error("Failed to load FG/SFG items:", e);
            setFgOptions(
                Object.values(GSV7_ITEMS)
                    .filter((item) => item.type === "FG" || item.type === "SFG")
                    .map((item) => ({
                        id: getGsv7ItemIdByCode(item.code),
                        code: item.code,
                        name: item.name,
                    })),
            );
        } finally {
            setIsLoadingFg(false);
        }
    }, [fgTypeId, sfgTypeId]);

    const loadOperationOptions = useCallback(async () => {
        setIsLoadingOps(true);
        try {
            const res = await operationsApi.getAll({ page: 1, limit: 500 });
            if (!res?.isSuccessful) {
                setOperationOptions(mergeOperationOptions([], getGsv7DemoOperationOptions()));
                return;
            }
            const records = Array.isArray(res?.data?.records) ? res.data.records : [];
            const mapped = records
                .map((row: { operation?: { id?: number; code?: string; name?: string } }) => {
                    const op = row?.operation ?? row;
                    return {
                        id: Number((op as { id?: number }).id),
                        code: String((op as { code?: string }).code ?? "").trim(),
                        name: String((op as { name?: string }).name ?? "").trim(),
                    };
                })
                .filter((op) => Number.isFinite(op.id) && op.id > 0 && op.code && op.name);
            setOperationOptions(mergeOperationOptions(mapped, getGsv7DemoOperationOptions()));
        } catch (e) {
            console.error("Failed to load operations:", e);
            setOperationOptions(getGsv7DemoOperationOptions());
        } finally {
            setIsLoadingOps(false);
        }
    }, []);

    useEffect(() => {
        setSkuRecords(loadProcurementSkuRecords());
        refreshMappingList();
        void loadFgOptions();
        void loadOperationOptions();
    }, [loadFgOptions, loadOperationOptions, refreshMappingList]);

    const selectedFg = useMemo(
        () => fgOptions.find((f) => String(f.id) === selectedFgId),
        [fgOptions, selectedFgId],
    );
    const selectedSku = useMemo(
        () => skuRecords.find((s) => String(s.id) === selectedSkuId),
        [skuRecords, selectedSkuId],
    );

    const closeConfigureForm = useCallback(() => {
        setShowConfigureForm(false);
        setFormMode("create");
        setSelectedFgId("");
        setSelectedSkuId("");
        setSequenceRows([]);
        setActiveMappingKey(null);
        setSelectedOperationId("");
    }, []);

    const loadMappingIntoForm = useCallback((record: SkuOperationMappingRecord) => {
        setFormMode("edit");
        setShowConfigureForm(true);
        setSelectedFgId(String(record.fg_item_id));
        setSelectedSkuId(String(record.sku_id));
        setSequenceRows(withSkuOperationSequences(record.operations));
        setActiveMappingKey(skuOperationMappingKey(record.fg_item_id, record.sku_id));
        setSelectedOperationId("");
    }, []);

    useEffect(() => {
        if (!selectedFgId || !selectedSkuId) {
            if (!activeMappingKey) setSequenceRows([]);
            return;
        }
        const fgId = Number(selectedFgId);
        const skuId = Number(selectedSkuId);
        if (!Number.isFinite(fgId) || !Number.isFinite(skuId)) return;

        const key = skuOperationMappingKey(fgId, skuId);
        if (activeMappingKey === key) return;

        const stored = getSkuOperationMapping(fgId, skuId);
        setSequenceRows(stored?.operations ? withSkuOperationSequences(stored.operations) : []);
        setActiveMappingKey(key);
        setSelectedOperationId("");
    }, [selectedFgId, selectedSkuId, activeMappingKey]);

    const filteredMappingList = useMemo(() => {
        const q = debouncedSearchTerm.trim().toLowerCase();
        if (!q) return mappingList;
        return mappingList.filter(
            (r) =>
                r.fg_code.toLowerCase().includes(q) ||
                r.fg_name.toLowerCase().includes(q) ||
                r.sku_code.toLowerCase().includes(q) ||
                r.sku_name.toLowerCase().includes(q) ||
                r.operations.some(
                    (op) =>
                        op.operation_code.toLowerCase().includes(q) ||
                        op.operation_name.toLowerCase().includes(q),
                ),
        );
    }, [mappingList, debouncedSearchTerm]);

    const operationDropdownOptions = useMemo(
        () =>
            operationOptions.map((op) => ({
                label: `${op.code} | ${op.name}`,
                value: String(op.id),
                primaryText: op.code,
                secondaryText: op.name,
                disabled: sequenceRows.some((r) => r.operation_id === op.id),
            })),
        [operationOptions, sequenceRows],
    );

    const fgDropdownOptions = useMemo(
        () =>
            fgOptions.map((fg) => ({
                label: `${fg.code} — ${fg.name}`,
                value: String(fg.id),
                primaryText: fg.name,
                secondaryText: fg.code,
            })),
        [fgOptions],
    );

    const skuDropdownOptions = useMemo(
        () =>
            skuRecords.map((sku) => ({
                label: `${sku.code} — ${sku.name}`,
                value: String(sku.id),
                primaryText: sku.name,
                secondaryText: sku.code,
            })),
        [skuRecords],
    );

    const handleNewMapping = () => {
        setFormMode("create");
        setShowConfigureForm(true);
        setSelectedFgId("");
        setSelectedSkuId("");
        setSequenceRows([]);
        setActiveMappingKey(null);
        setSelectedOperationId("");
    };

    const handleAddOperation = () => {
        const opId = coerceSelectValue(selectedOperationId);
        if (!opId) return;
        const op = operationOptions.find((o) => String(o.id) === opId);
        if (!op) {
            toast({
                variant: "destructive",
                title: "Operation not found",
                description: "Select an operation from the list and click Add again.",
            });
            return;
        }
        if (sequenceRows.some((r) => r.operation_id === op.id)) {
            toast({
                variant: "destructive",
                title: "Duplicate Operation",
                description: "This operation is already in the sequence.",
            });
            return;
        }
        setSequenceRows((prev) =>
            withSkuOperationSequences([
                ...prev,
                {
                    operation_id: op.id,
                    operation_code: op.code,
                    operation_name: op.name,
                    sequence: prev.length + 1,
                },
            ]),
        );
        setSelectedOperationId("");
    };

    const handleRemove = (operationId: number) => {
        setSequenceRows((prev) => withSkuOperationSequences(prev.filter((r) => r.operation_id !== operationId)));
    };

    const reorderRows = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setSequenceRows((prev) => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return withSkuOperationSequences(next);
        });
    };

    const handleSave = () => {
        if (!selectedFg || !selectedSku) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Select FG/SFG and SKU before saving.",
            });
            return;
        }
        if (sequenceRows.length === 0) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Add at least one operation to the sequence.",
            });
            return;
        }

        setIsSaving(true);
        try {
            const record: SkuOperationMappingRecord = {
                fg_item_id: selectedFg.id,
                fg_code: selectedFg.code,
                fg_name: selectedFg.name,
                sku_id: selectedSku.id,
                sku_code: selectedSku.code,
                sku_name: selectedSku.name,
                operations: sequenceRows,
            };
            saveSkuOperationMapping(record);
            setActiveMappingKey(skuOperationMappingKey(record.fg_item_id, record.sku_id));
            refreshMappingList();
            toast({
                ...crudSuccessToast,
                title: "Mapping Saved",
                description: `SKU operation flow saved for ${selectedFg.code} / ${selectedSku.code}.`,
            });
            closeConfigureForm();
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (record: SkuOperationMappingRecord) => {
        setMappingToDelete(record);
        setIsDeleteAlertOpen(true);
    };

    const confirmDeleteMapping = () => {
        if (!mappingToDelete) return;
        setIsDeleting(true);
        try {
            deleteSkuOperationMapping(mappingToDelete.fg_item_id, mappingToDelete.sku_id);
            refreshMappingList();
            const key = skuOperationMappingKey(mappingToDelete.fg_item_id, mappingToDelete.sku_id);
            if (activeMappingKey === key) closeConfigureForm();
            toast({
                ...crudSuccessToast,
                title: "Deleted",
                description: "SKU operation mapping removed.",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteAlertOpen(false);
            setMappingToDelete(null);
        }
    };

    const isLoading = isLoadingFg || isLoadingOps;
    const canConfigure = Boolean(selectedFgId && selectedSkuId);

    return (
        <div className="flex flex-col gap-6">
            <AppListToolbar
                search={{
                    placeholder: "Search by code, name...",
                    value: searchTerm,
                    onChange: setSearchTerm,
                }}
                actions={
                    canEdit
                        ? [
                              {
                                  label: "New Mapping",
                                  icon: <Plus className="mr-2 h-4 w-4" />,
                                  onClick: handleNewMapping,
                              },
                          ]
                        : []
                }
            />

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>SKU Operation List</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                    <div className="min-w-0 max-w-full overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="min-w-[180px]">FG/SFG</TableHead>
                                    <TableHead className="min-w-[180px]">SKU</TableHead>
                                    <TableHead className="text-center w-[100px]">Operations</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMappingList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-24 text-center text-muted-foreground text-sm"
                                        >
                                            {mappingList.length === 0
                                                ? 'No mappings yet. Click "New Mapping" to create one.'
                                                : "No mappings match your search."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMappingList.map((row) => {
                                        const key = skuOperationMappingKey(row.fg_item_id, row.sku_id);
                                        const isActive = activeMappingKey === key;
                                        return (
                                            <TableRow
                                                key={key}
                                                className={cn(isActive && "bg-blue-50/60")}
                                            >
                                                <TableCell className="min-w-[180px] align-top whitespace-normal">
                                                    <div
                                                        className="text-sm font-medium wrap-anywhere"
                                                        title={row.fg_name}
                                                    >
                                                        {row.fg_name}
                                                    </div>
                                                    <div
                                                        className="font-mono text-xs text-muted-foreground wrap-anywhere"
                                                        title={row.fg_code}
                                                    >
                                                        {row.fg_code}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="min-w-[180px] align-top whitespace-normal">
                                                    <div
                                                        className="text-sm font-medium wrap-anywhere"
                                                        title={row.sku_name}
                                                    >
                                                        {row.sku_name}
                                                    </div>
                                                    <div
                                                        className="font-mono text-xs text-muted-foreground wrap-anywhere"
                                                        title={row.sku_code}
                                                    >
                                                        {row.sku_code}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center text-sm font-medium tabular-nums">
                                                    {row.operations.length}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <TableActionButtons
                                                        onEdit={
                                                            canEdit
                                                                ? () => loadMappingIntoForm(row)
                                                                : undefined
                                                        }
                                                        onDelete={
                                                            canDelete
                                                                ? () => handleDeleteClick(row)
                                                                : undefined
                                                        }
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={showConfigureForm}
                onOpenChange={(open) => {
                    if (!open) closeConfigureForm();
                }}
            >
                <DialogContent className="flex w-[95%] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
                    <DialogHeader className="space-y-2 shrink-0 border-b bg-white p-6 pb-5">
                        <DialogTitle>
                            {formMode === "edit" ? "Edit SKU Operation Mapping" : "New SKU Operation Mapping"}
                        </DialogTitle>
                        <DialogDescription>
                            Select FG/SFG and SKU, add operations in sequence, then save.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-6">
                        {isLoading && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading options...</p>
                            </div>
                        )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <SearchableSelect
                            label="FG/SFG"
                            required
                            placeholder="Select FG/SFG"
                            value={selectedFgId || undefined}
                            options={fgDropdownOptions}
                            onChange={(val) => {
                                setActiveMappingKey(null);
                                setSelectedFgId(coerceSelectValue(val));
                            }}
                            disabled={!canEdit}
                        />
                        <SearchableSelect
                            label="SKU"
                            required
                            placeholder="Select SKU"
                            value={selectedSkuId || undefined}
                            options={skuDropdownOptions}
                            onChange={(val) => {
                                setActiveMappingKey(null);
                                setSelectedSkuId(coerceSelectValue(val));
                            }}
                            disabled={!canEdit}
                        />
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                            <Label className="text-xs font-semibold">Operation</Label>
                            <SearchableSelect
                                placeholder="Search & Select Operation"
                                value={selectedOperationId || undefined}
                                options={operationDropdownOptions}
                                onChange={(val) => setSelectedOperationId(coerceSelectValue(val))}
                                disabled={!canEdit || isLoadingOps}
                                selectedTruncate="end"
                                listClassName="max-h-[min(50vh,320px)]"
                            />
                        </div>
                        {canEdit && (
                            <Button
                                type="button"
                                onClick={handleAddOperation}
                                disabled={!selectedOperationId || isLoadingOps}
                                className="h-10 w-full shrink-0 px-6 md:w-auto"
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        )}
                    </div>

                    <div
                        className={cn(
                            "rounded-md border overflow-x-auto",
                            sequenceRows.length > 3 &&
                                "max-h-[min(16rem,40vh)] overflow-y-auto custom-scrollbar",
                        )}
                    >
                        <Table className="min-w-[640px] w-full">
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="h-12 w-[52px]" />
                                    <TableHead className="h-12 w-[90px] text-xs">Sequence</TableHead>
                                    <TableHead className="h-12 min-w-[120px] text-xs">
                                        Operation Code
                                    </TableHead>
                                    <TableHead className="h-12 min-w-[200px] text-xs">
                                        Operation Name
                                    </TableHead>
                                    <TableHead className="h-12 w-[88px] min-w-[88px] text-center text-xs">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sequenceRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="h-24 text-center text-muted-foreground text-xs italic"
                                        >
                                            No operations in this sequence. Select an operation and click
                                            Add.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sequenceRows.map((row, index) => (
                                                <TableRow
                                                    key={row.operation_id}
                                                    draggable={canEdit}
                                                    onDragStart={() =>
                                                        canEdit && setDraggedRowIndex(index)
                                                    }
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        if (canEdit && draggedRowIndex !== null) {
                                                            setDragOverRowIndex(index);
                                                        }
                                                    }}
                                                    onDrop={() => {
                                                        if (canEdit && draggedRowIndex !== null) {
                                                            reorderRows(draggedRowIndex, index);
                                                            setDraggedRowIndex(null);
                                                            setDragOverRowIndex(null);
                                                        }
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggedRowIndex(null);
                                                        setDragOverRowIndex(null);
                                                    }}
                                                    className={cn(
                                                        canEdit && "cursor-grab active:cursor-grabbing",
                                                        draggedRowIndex === index && "opacity-50",
                                                        dragOverRowIndex === index &&
                                                            draggedRowIndex !== index &&
                                                            "bg-muted/40",
                                                    )}
                                                >
                                                    <TableCell className="py-4 text-center">
                                                        {canEdit && (
                                                            <GripVertical className="h-4 w-4 inline text-muted-foreground" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-4 text-sm font-semibold text-center">
                                                        {row.sequence}
                                                    </TableCell>
                                                    <TableCell className="py-4 font-mono text-xs">
                                                        {row.operation_code}
                                                    </TableCell>
                                                    <TableCell className="py-4 text-sm font-medium">
                                                        {row.operation_name}
                                                    </TableCell>
                                                    <TableCell className="py-4 text-center pr-4">
                                                        {canEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                onClick={() =>
                                                                    handleRemove(row.operation_id)
                                                                }
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {!canConfigure && !isLoading && (
                        <p className="text-xs text-muted-foreground">
                            Select FG/SFG and SKU above before saving this mapping.
                        </p>
                    )}
                    </div>

                    <DialogFooter className="shrink-0 gap-3 border-t bg-white px-6 pb-6 pt-7">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeConfigureForm}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        {canEdit && (
                            <Button
                                type="button"
                                onClick={handleSave}
                                loading={isSaving}
                                disabled={
                                    !selectedFgId ||
                                    !selectedSkuId ||
                                    sequenceRows.length === 0
                                }
                            >
                                Save Mapping
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={isDeleteAlertOpen}
                onOpenChange={(open) => {
                    setIsDeleteAlertOpen(open);
                    if (!open) setMappingToDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete SKU Operation Mapping</AlertDialogTitle>
                        <AlertDialogDescription>
                            {mappingToDelete ? (
                                <>
                                    Are you sure you want to delete the mapping for{" "}
                                    <span className="font-semibold text-foreground">
                                        {mappingToDelete.fg_name} / {mappingToDelete.sku_name}
                                    </span>
                                    ? This action cannot be undone.
                                </>
                            ) : (
                                "Are you sure you want to delete this mapping? This action cannot be undone."
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteMapping}
                            loading={isDeleting}
                            disabled={isDeleting}
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
