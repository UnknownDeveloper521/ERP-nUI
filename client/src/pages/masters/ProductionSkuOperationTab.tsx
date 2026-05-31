import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
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
import { commonApi, parseSkuDropdownRecords, skuOperationApi, type SkuOperationDetailOperation, type SkuOperationDetailRecord, type SkuOperationListRecord } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import {
    skuOperationMappingKey,
    type SkuMappedOperation,
} from "@/lib/skuOperationMappingStorage";
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

interface SkuOption {
    id: number;
    code: string;
    name: string;
}

interface SkuOperationSequenceRow extends SkuMappedOperation {
    lineId?: number;
}

function withSequenceRows(rows: SkuOperationSequenceRow[]): SkuOperationSequenceRow[] {
    return rows.map((row, index) => ({ ...row, sequence: index + 1 }));
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

function mapDetailOperationsToSequenceRows(
    operations: SkuOperationDetailOperation[],
): SkuOperationSequenceRow[] {
    return withSequenceRows(
        [...operations]
            .sort((a, b) => a.sequence - b.sequence)
            .map((op) => ({
                lineId: op.id,
                operation_id: op.operation_id,
                operation_code: op.operation_code,
                operation_name: op.operation_name,
                sequence: op.sequence,
            })),
    );
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
    const [skuRecords, setSkuRecords] = useState<SkuOption[]>([]);
    const [operationOptions, setOperationOptions] = useState<OperationOption[]>([]);
    const [mappingList, setMappingList] = useState<SkuOperationListRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalMappingCount, setTotalMappingCount] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);

    const [selectedFgId, setSelectedFgId] = useState<string>("");
    const [selectedSkuId, setSelectedSkuId] = useState<string>("");
    const [selectedOperationId, setSelectedOperationId] = useState<string>("");
    const [sequenceRows, setSequenceRows] = useState<SkuOperationSequenceRow[]>([]);
    const [activeMappingKey, setActiveMappingKey] = useState<string | null>(null);
    const [showConfigureForm, setShowConfigureForm] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingMappingId, setEditingMappingId] = useState<number | null>(null);
    const [deletedOperationLineIds, setDeletedOperationLineIds] = useState<number[]>([]);

    const [isLoadingFg, setIsLoadingFg] = useState(false);
    const [isLoadingSku, setIsLoadingSku] = useState(false);
    const [isLoadingOps, setIsLoadingOps] = useState(false);
    const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [mappingToDelete, setMappingToDelete] = useState<SkuOperationListRecord | null>(null);
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);
    const editSkuPreserveRef = useRef<SkuOption | null>(null);

    const fetchSkuOperationList = useCallback(async () => {
        setIsListLoading(true);
        setListError(null);
        try {
            const res = await skuOperationApi.getList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm.trim() || undefined,
            });
            if (res.isSuccessful && res.data) {
                setMappingList(res.data.records ?? []);
                const pagination = res.data.pagination;
                setTotalMappingCount(
                    pagination?.totalCount != null ? pagination.totalCount : (res.data.records ?? []).length,
                );
            } else {
                setListError(res.message || "Failed to load SKU operation mappings.");
                setMappingList([]);
                setTotalMappingCount(0);
            }
        } catch {
            setListError("Unable to load SKU operation mappings. Please try again.");
            setMappingList([]);
            setTotalMappingCount(0);
        } finally {
            setIsListLoading(false);
        }
    }, [currentPage, itemsPerPage, debouncedSearchTerm]);

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
                if (!res.isSuccessful) continue;
                for (const row of mapDropdownResponse(res)) {
                    byId.set(row.id, row);
                }
            }

            const merged = [...byId.values()].sort((a, b) =>
                a.code.localeCompare(b.code, undefined, { sensitivity: "base" }),
            );
            setFgOptions(merged);
        } catch (e) {
            console.error("Failed to load FG/SFG items:", e);
            setFgOptions([]);
        } finally {
            setIsLoadingFg(false);
        }
    }, [fgTypeId, sfgTypeId]);

    const loadSkuOptions = useCallback(async (itemId?: number) => {
        if (itemId == null || !Number.isFinite(itemId) || itemId <= 0) {
            setSkuRecords([]);
            return;
        }

        setIsLoadingSku(true);
        try {
            const res = await commonApi.getSkuDropdown({ item_id: itemId });
            if (res.isSuccessful && res.data) {
                const records = [...parseSkuDropdownRecords(res.data)];
                const preserve = editSkuPreserveRef.current;
                if (preserve && preserve.id > 0 && preserve.code && preserve.name) {
                    editSkuPreserveRef.current = null;
                    if (!records.some((sku) => sku.id === preserve.id)) {
                        records.push(preserve);
                        records.sort((a, b) =>
                            a.code.localeCompare(b.code, undefined, { sensitivity: "base" }),
                        );
                    }
                }
                setSkuRecords(records);
            } else {
                setSkuRecords([]);
            }
        } catch (e) {
            console.error("Failed to load SKUs:", e);
            setSkuRecords([]);
        } finally {
            setIsLoadingSku(false);
        }
    }, []);

    const loadOperationOptions = useCallback(async () => {
        setIsLoadingOps(true);
        try {
            const res = await commonApi.getOperations();
            if (!res.isSuccessful) {
                setOperationOptions([]);
                return;
            }
            const records = Array.isArray(res.data?.records) ? res.data.records : [];
            const mapped = records
                .map((row: Record<string, unknown>) => ({
                    id: Number(row.id ?? row.operation_id),
                    code: String(row.code ?? row.operation_code ?? "").trim(),
                    name: String(row.name ?? row.operation_name ?? "").trim(),
                }))
                .filter((op) => Number.isFinite(op.id) && op.id > 0 && op.code && op.name);
            setOperationOptions(mapped);
        } catch (e) {
            console.error("Failed to load operations:", e);
            setOperationOptions([]);
        } finally {
            setIsLoadingOps(false);
        }
    }, []);

    useEffect(() => {
        void fetchSkuOperationList();
    }, [fetchSkuOperationList]);

    useEffect(() => {
        if (!showConfigureForm) return;
        void loadFgOptions();
        void loadOperationOptions();
    }, [showConfigureForm, loadFgOptions, loadOperationOptions]);

    useEffect(() => {
        if (!showConfigureForm) return;
        const itemId = Number(selectedFgId);
        void loadSkuOptions(Number.isFinite(itemId) && itemId > 0 ? itemId : undefined);
    }, [showConfigureForm, selectedFgId, loadSkuOptions]);

    const totalPages = Math.max(1, Math.ceil(totalMappingCount / itemsPerPage));

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, itemsPerPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

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
        setEditingMappingId(null);
        setDeletedOperationLineIds([]);
        setSelectedFgId("");
        setSelectedSkuId("");
        setSequenceRows([]);
        setActiveMappingKey(null);
        setSelectedOperationId("");
    }, []);

    const ensureDetailOptionsInDropdowns = useCallback((detail: SkuOperationDetailRecord) => {
        if (detail.item_id > 0 && detail.item_code && detail.item_name) {
            setFgOptions((prev) => {
                if (prev.some((item) => item.id === detail.item_id)) return prev;
                return [
                    ...prev,
                    { id: detail.item_id, code: detail.item_code, name: detail.item_name },
                ].sort((a, b) => a.code.localeCompare(b.code, undefined, { sensitivity: "base" }));
            });
        }

        if (detail.sku_id > 0 && detail.sku_code && detail.sku_name) {
            setSkuRecords((prev) => {
                if (prev.some((sku) => sku.id === detail.sku_id)) return prev;
                return [
                    ...prev,
                    { id: detail.sku_id, code: detail.sku_code, name: detail.sku_name },
                ].sort((a, b) => a.code.localeCompare(b.code, undefined, { sensitivity: "base" }));
            });
        }
    }, []);

    const handleEditClick = useCallback(
        async (row: SkuOperationListRecord) => {
            setFormMode("edit");
            setShowConfigureForm(true);
            setEditingMappingId(row.id);
            setDeletedOperationLineIds([]);
            setSelectedFgId("");
            setSelectedSkuId("");
            setSequenceRows([]);
            setActiveMappingKey(null);
            setSelectedOperationId("");
            setIsFormDetailLoading(true);

            try {
                const res = await skuOperationApi.getById(row.id);
                if (!res.isSuccessful || !res.data) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res.message || "Failed to load SKU operation mapping.",
                    });
                    closeConfigureForm();
                    return;
                }

                const detail = res.data;
                ensureDetailOptionsInDropdowns(detail);
                editSkuPreserveRef.current = {
                    id: detail.sku_id,
                    code: detail.sku_code,
                    name: detail.sku_name,
                };
                setSelectedFgId(String(detail.item_id));
                setSelectedSkuId(String(detail.sku_id));
                setSequenceRows(mapDetailOperationsToSequenceRows(detail.operations ?? []));
                setActiveMappingKey(skuOperationMappingKey(detail.item_id, detail.sku_id));
            } catch (error: unknown) {
                const message =
                    error instanceof Error ? error.message : "Failed to load SKU operation mapping.";
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: message,
                });
                closeConfigureForm();
            } finally {
                setIsFormDetailLoading(false);
            }
        },
        [closeConfigureForm, ensureDetailOptionsInDropdowns, toast],
    );

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
        setEditingMappingId(null);
        setDeletedOperationLineIds([]);
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
            withSequenceRows([
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

    const handleRemove = (row: SkuOperationSequenceRow) => {
        if (row.lineId != null) {
            setDeletedOperationLineIds((prev) =>
                prev.includes(row.lineId!) ? prev : [...prev, row.lineId!],
            );
        }
        setSequenceRows((prev) =>
            withSequenceRows(prev.filter((r) => r.operation_id !== row.operation_id)),
        );
    };

    const reorderRows = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setSequenceRows((prev) => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return withSequenceRows(next);
        });
    };

    const handleSave = async () => {
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
            if (formMode === "create") {
                const res = await skuOperationApi.create({
                    item_id: selectedFg.id,
                    sku_id: selectedSku.id,
                    operations: sequenceRows.map((row) => ({
                        operation_id: row.operation_id,
                        sequence: row.sequence,
                    })),
                });
                if (res.isSuccessful) {
                    toast({
                        ...crudSuccessToast,
                        title: "Mapping Created",
                        description:
                            res.message ||
                            `SKU operation mapping created for ${selectedFg.code} / ${selectedSku.code}.`,
                    });
                    closeConfigureForm();
                    if (currentPage !== 1) {
                        setCurrentPage(1);
                    } else {
                        void fetchSkuOperationList();
                    }
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res.message || "Failed to create SKU operation mapping.",
                    });
                }
                return;
            }

            if (editingMappingId == null) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Mapping id is missing. Please reopen the record and try again.",
                });
                return;
            }

            const res = await skuOperationApi.update(editingMappingId, {
                item_id: selectedFg.id,
                sku_id: selectedSku.id,
                operations: sequenceRows.map((row) => {
                    const operation: {
                        operation_id: number;
                        sequence: number;
                        id?: number;
                    } = {
                        operation_id: row.operation_id,
                        sequence: row.sequence,
                    };
                    if (row.lineId != null) operation.id = row.lineId;
                    return operation;
                }),
                delete: deletedOperationLineIds.map((id) => ({ id })),
            });
            if (res.isSuccessful) {
                toast({
                    ...crudSuccessToast,
                    title: "Mapping Updated",
                    description:
                        res.message ||
                        `SKU operation mapping updated for ${selectedFg.code} / ${selectedSku.code}.`,
                });
                closeConfigureForm();
                void fetchSkuOperationList();
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: res.message || "Failed to update SKU operation mapping.",
                });
            }
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : "Failed to save SKU operation mapping.";
            toast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (record: SkuOperationListRecord) => {
        setMappingToDelete(record);
        setIsDeleteAlertOpen(true);
    };

    const confirmDeleteMapping = async () => {
        if (!mappingToDelete) return;
        setIsDeleting(true);
        try {
            const res = await skuOperationApi.delete(mappingToDelete.id);
            if (res.isSuccessful) {
                toast({
                    ...crudSuccessToast,
                    title: "Deleted",
                    description: res.message || "SKU operation mapping deleted successfully.",
                });
                if (editingMappingId === mappingToDelete.id) closeConfigureForm();
                if (mappingList.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                } else {
                    void fetchSkuOperationList();
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: res.message || "Failed to delete SKU operation mapping.",
                });
            }
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : "Failed to delete SKU operation mapping.";
            toast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteAlertOpen(false);
            setMappingToDelete(null);
        }
    };

    const isLoading = isLoadingFg || isLoadingSku || isLoadingOps || isFormDetailLoading;
    const canConfigure = Boolean(selectedFgId && selectedSkuId);

    const renderListLoadingRow = (colSpan: number) => (
        <TableRow>
            <TableCell colSpan={colSpan} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </TableCell>
        </TableRow>
    );

    return (
        <div className="flex flex-col gap-6">
            <AppListToolbar
                search={{
                    placeholder: "Search by code, name...",
                    value: searchTerm,
                    onChange: (val: string) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
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
                                {isListLoading ? (
                                    renderListLoadingRow(4)
                                ) : listError ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-24 text-center text-destructive text-sm"
                                        >
                                            {listError}
                                        </TableCell>
                                    </TableRow>
                                ) : mappingList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-24 text-center text-muted-foreground text-sm"
                                        >
                                            {debouncedSearchTerm.trim()
                                                ? "No mappings match your search."
                                                : 'No mappings yet. Click "New Mapping" to create one.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    mappingList.map((row) => {
                                        const key = skuOperationMappingKey(row.item_id, row.sku_id);
                                        const isActive = activeMappingKey === key;
                                        return (
                                            <TableRow
                                                key={row.id}
                                                className={cn(isActive && "bg-blue-50/60")}
                                            >
                                                <TableCell className="min-w-[180px] align-top whitespace-normal">
                                                    <div
                                                        className="text-sm font-medium wrap-anywhere"
                                                        title={row.item_name}
                                                    >
                                                        {row.item_name}
                                                    </div>
                                                    <div
                                                        className="font-mono text-xs text-muted-foreground wrap-anywhere"
                                                        title={row.item_code}
                                                    >
                                                        {row.item_code}
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
                                                    {row.operation_count}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <TableActionButtons
                                                        onEdit={
                                                            canEdit ? () => void handleEditClick(row) : undefined
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

                    {!isListLoading && !listError && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalMappingCount}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    )}
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
                                if (formMode === "create") {
                                    setSelectedSkuId("");
                                }
                            }}
                            disabled={!canEdit || isLoadingFg}
                        />
                        <SearchableSelect
                            label="SKU"
                            required
                            placeholder={selectedFgId ? "Select SKU" : "Select FG/SFG first"}
                            value={selectedSkuId || undefined}
                            options={skuDropdownOptions}
                            onChange={(val) => {
                                setActiveMappingKey(null);
                                setSelectedSkuId(coerceSelectValue(val));
                            }}
                            disabled={!canEdit || isLoadingSku || !selectedFgId}
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
                                                    key={row.lineId ?? `new-${row.operation_id}`}
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
                                                                onClick={() => handleRemove(row)}
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
                                    isFormDetailLoading ||
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
                                        {mappingToDelete.item_name} / {mappingToDelete.sku_name}
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
