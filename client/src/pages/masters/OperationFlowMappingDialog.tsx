import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { operationsApi } from "@/lib/api";
import { getGsv7DemoOperationOptions } from "@/lib/gsv7OperationsMockData";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
const OPERATION_FLOW_MAPPING_STORAGE_KEY = "master-erp-operation-flow-mappings";

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

const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

interface OperationOption {
    id: number;
    code: string;
    name: string;
}

export interface OperationFlowParent {
    id: number;
    code: string;
    name: string;
}

function withSequences(rows: MappedFlowOperation[]): MappedFlowOperation[] {
    return rows.map((row, index) => ({ ...row, sequence: index + 1 }));
}

function saveOperationFlowMapping(parentOperationId: number, operations: MappedFlowOperation[]) {
    const all = loadAllOperationFlowMappings();
    all[String(parentOperationId)] = withSequences(operations);
    localStorage.setItem(OPERATION_FLOW_MAPPING_STORAGE_KEY, JSON.stringify(all));
}

interface OperationFlowMappingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentOperation: OperationFlowParent | null;
    canEdit: boolean;
}

export function OperationFlowMappingDialog({
    open,
    onOpenChange,
    parentOperation,
    canEdit,
}: OperationFlowMappingDialogProps) {
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [operationOptions, setOperationOptions] = useState<OperationOption[]>([]);
    const [selectedOperationId, setSelectedOperationId] = useState<string>("");
    const [sequenceRows, setSequenceRows] = useState<MappedFlowOperation[]>([]);
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!open || !parentOperation) return;

        setSelectedOperationId("");
        setDraggedRowIndex(null);
        setDragOverRowIndex(null);

        const stored = loadAllOperationFlowMappings()[String(parentOperation.id)];
        setSequenceRows(stored ? withSequences(stored) : []);

        setIsLoading(true);
        operationsApi
            .getAll({ page: 1, limit: 500 })
            .then((res) => {
                if (!res.isSuccessful) return;
                const records = Array.isArray(res?.data?.records) ? res.data.records : [];
                const mapped = records
                    .map((row: any) => {
                        const op = row?.operation ?? row;
                        return {
                            id: Number(op.id),
                            code: String(op.code ?? "").trim(),
                            name: String(op.name ?? "").trim(),
                        };
                    })
                    .filter((op) => Number.isFinite(op.id) && op.id > 0 && op.code && op.name);
                setOperationOptions(mergeOperationOptions(mapped, getGsv7DemoOperationOptions()));
            })
            .catch((err) => console.error("Error loading operations for flow mapping:", err))
            .finally(() => setIsLoading(false));
    }, [open, parentOperation]);

    const dropdownOptions = useMemo(
        () =>
            operationOptions.map((op) => ({
                label: `${op.code} | ${op.name}`,
                value: String(op.id),
                primaryText: op.code,
                secondaryText: op.name,
                disabled:
                    sequenceRows.some((r) => r.operation_id === op.id) ||
                    parentOperation?.id === op.id,
            })),
        [operationOptions, sequenceRows, parentOperation?.id],
    );

    const handleClose = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
            setSelectedOperationId("");
            setDraggedRowIndex(null);
            setDragOverRowIndex(null);
        }
    };

    const handleAddOperation = () => {
        if (!selectedOperationId) return;
        const op = operationOptions.find((o) => String(o.id) === selectedOperationId);
        if (!op) return;
        if (sequenceRows.some((r) => r.operation_id === op.id)) {
            toast({
                variant: "destructive",
                title: "Duplicate Operation",
                description: "This operation is already in the flow sequence.",
            });
            return;
        }
        setSequenceRows((prev) =>
            withSequences([
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
        setSequenceRows((prev) => withSequences(prev.filter((r) => r.operation_id !== operationId)));
    };

    const reorderRows = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setSequenceRows((prev) => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return withSequences(next);
        });
    };

    const handleSaveMapping = () => {
        if (!parentOperation) return;
        if (sequenceRows.length === 0) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Add at least one operation to the flow before saving.",
            });
            return;
        }
        saveOperationFlowMapping(parentOperation.id, sequenceRows);
        toast({
            ...crudSuccessToast,
            title: "Mapping Saved",
            description: "Operation flow mapping saved successfully.",
        });
        handleClose(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="flex w-[95%] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
                <DialogHeader className="space-y-2 p-6 pb-5 shrink-0 border-b bg-white">
                    <DialogTitle>Operation Flow Mapping</DialogTitle>
                    <DialogDescription>
                        Configure operation sequence and execution flow
                        {parentOperation ? ` for ${parentOperation.code}` : ""}.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                            <div className="min-w-0 flex-1 space-y-2">
                                <Label className="text-xs font-semibold">Operation</Label>
                                <SearchableSelect
                                    placeholder="Search & Select Operation"
                                    value={selectedOperationId || undefined}
                                    options={dropdownOptions}
                                    onChange={setSelectedOperationId}
                                    disabled={!canEdit || isLoading}
                                    selectedTruncate="end"
                                    listClassName="max-h-[min(50vh,320px)]"
                                />
                            </div>
                            {canEdit && (
                                <Button
                                    type="button"
                                    onClick={handleAddOperation}
                                    disabled={!selectedOperationId || isLoading}
                                    className="h-10 w-full shrink-0 px-6 md:w-auto"
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                            )}
                        </div>

                        <div
                            className={cn(
                                "rounded-md border overflow-x-auto",
                                sequenceRows.length > 6
                                    ? "max-h-[min(50vh,420px)] overflow-y-auto"
                                    : "",
                            )}
                        >
                            <Table className="min-w-[640px] w-full">
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="h-12 w-[52px]"></TableHead>
                                        <TableHead className="h-12 w-[90px] text-xs">Sequence</TableHead>
                                        <TableHead className="h-12 min-w-[120px] text-xs">Operation Code</TableHead>
                                        <TableHead className="h-12 min-w-[200px] text-xs">Operation Name</TableHead>
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
                                                No operations in this flow sequence.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sequenceRows.map((row, index) => (
                                            <TableRow
                                                key={row.operation_id}
                                                draggable={canEdit}
                                                onDragStart={() => canEdit && setDraggedRowIndex(index)}
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
                                                        <span
                                                            className="inline-flex text-muted-foreground"
                                                            title="Drag to reorder"
                                                        >
                                                            <GripVertical className="h-4 w-4" />
                                                        </span>
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
                                                            onClick={() => handleRemove(row.operation_id)}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            title="Delete"
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
                    </div>
                </div>

                <DialogFooter className="gap-3 border-t px-6 pb-6 pt-7 shrink-0 bg-white">
                    <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    {canEdit && (
                        <Button
                            onClick={handleSaveMapping}
                            disabled={isLoading || sequenceRows.length === 0}
                        >
                            Save Mapping
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
