import { useState, useEffect, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { commonApi, skuApi, type CreateSkuRequest, type SkuDetailRecord } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";

const SKU_STORAGE_KEY = "master-erp-procurement-skus";

const SKU_CODE_MAX_LENGTH = 150;
const SKU_NAME_MAX_LENGTH = 150;
const SKU_TOAST_DURATION_MS = 15000;

export interface SkuRecord {
    id: number;
    code: string;
    name: string;
    item_id?: number;
    item_code?: string;
    item_name?: string;
    dimensions?: string;
    weight?: string;
    type?: string;
    description?: string;
}

interface ItemOption {
    id: number;
    code: string;
    name: string;
}

interface SkuFormData {
    code: string;
    itemId: string;
    name: string;
    dimensions: string;
    weight: string;
    type: string;
    description: string;
}

interface SkuFormErrors {
    code: string;
    name: string;
}

const emptySkuForm: SkuFormData = {
    code: "",
    itemId: "",
    name: "",
    dimensions: "",
    weight: "",
    type: "",
    description: "",
};

const emptySkuFormErrors: SkuFormErrors = {
    code: "",
    name: "",
};

const hasMinTwoChars = (value: string) => String(value ?? "").trim().length >= 2;

const CODE_NAME_INLINE_ERROR = "Minimum two characters required";

/** Show error once the field is non-empty but still under 2 characters (trimmed). */
const getCodeNameInlineError = (value: string): string | null => {
    const t = String(value ?? "").trim();
    if (!t) return null;
    return hasMinTwoChars(t) ? null : CODE_NAME_INLINE_ERROR;
};

export const INITIAL_SKU_MOCK_RECORDS: SkuRecord[] = [
    {
        id: 1,
        code: "SKU-001",
        name: "Plate P&N Single 1.4mm",
        dimensions: "147*48*1.4",
        weight: "0.25 Kg",
        type: "P & N SINGLE",
        description: "Plate P&N Single battery component with 1.4mm thickness.",
    },
    {
        id: 2,
        code: "SKU-002",
        name: "Plate P Double 1mm",
        dimensions: "147*48*1",
        weight: "0.22 Kg",
        type: "P DOUBLE",
        description: "Plate P Double battery component with 1mm thickness.",
    },
    {
        id: 3,
        code: "SKU-003",
        name: "Plate P&N Single 1mm",
        dimensions: "147*48*1",
        weight: "0.22 Kg",
        type: "P & N SINGLE",
        description: "Plate P&N Single battery component with 1mm thickness.",
    },
];

export function loadProcurementSkuRecords(): SkuRecord[] {
    try {
        const raw = localStorage.getItem(SKU_STORAGE_KEY);
        if (!raw) {
            saveSkusToStorage(INITIAL_SKU_MOCK_RECORDS);
            return [...INITIAL_SKU_MOCK_RECORDS];
        }
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed) ? parsed : [];
        if (records.length === 0) {
            saveSkusToStorage(INITIAL_SKU_MOCK_RECORDS);
            return [...INITIAL_SKU_MOCK_RECORDS];
        }
        return records;
    } catch {
        throw new Error("Failed to load SKU records");
    }
}

function saveSkusToStorage(records: SkuRecord[]) {
    localStorage.setItem(SKU_STORAGE_KEY, JSON.stringify(records));
}

function nextSkuId(records: SkuRecord[]): number {
    if (records.length === 0) return 1;
    return Math.max(...records.map((r) => r.id)) + 1;
}

function mapSkuDetailToForm(detail: SkuDetailRecord): SkuFormData {
    return {
        code: String(detail.code ?? "").slice(0, SKU_CODE_MAX_LENGTH),
        itemId: detail.items_id != null ? String(detail.items_id) : "",
        name: String(detail.name ?? "").slice(0, SKU_NAME_MAX_LENGTH),
        dimensions: String(detail.dimension ?? ""),
        weight: String(detail.weight ?? ""),
        type: String(detail.type ?? ""),
        description: String(detail.description ?? ""),
    };
}

function itemOptionFromSkuDetail(detail: SkuDetailRecord): ItemOption | null {
    const id = Number(detail.items_id);
    const code = String(detail.item_code ?? "").trim();
    const name = String(detail.item_name ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !code || !name) return null;
    return { id, code, name };
}

function buildSkuWritePayload(form: SkuFormData, itemsId: number): CreateSkuRequest {
    const payload: CreateSkuRequest = {
        code: form.code.trim(),
        name: form.name.trim(),
        items_id: itemsId,
    };
    const type = form.type.trim();
    const dimension = form.dimensions.trim();
    const weight = form.weight.trim();
    const description = form.description.trim();
    if (type) payload.type = type;
    if (dimension) payload.dimension = dimension;
    if (weight) payload.weight = weight;
    if (description) payload.description = description;
    return payload;
}

interface ProcurementSkuTabProps {
    permissionKey: string;
}

export function ProcurementSkuTab({ permissionKey }: ProcurementSkuTabProps) {
    const { toast } = useToast();
    const showSkuToast = (options: Parameters<typeof toast>[0]): void => {
        toast({ ...options, duration: SKU_TOAST_DURATION_MS });
    };
    const { canCreate, canEdit, canDelete } = useHasPermission();
    const itemTypes = useCommonStore((state) => state.itemTypes);

    const [allSkus, setAllSkus] = useState<SkuRecord[]>([]);
    const [listError, setListError] = useState<string | null>(null);
    const [isListLoading, setIsListLoading] = useState(true);
    const [totalSkuCount, setTotalSkuCount] = useState(0);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [skuToDeleteId, setSkuToDeleteId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [skuFormData, setSkuFormData] = useState<SkuFormData>(emptySkuForm);
    const [skuFormErrors, setSkuFormErrors] = useState<SkuFormErrors>(emptySkuFormErrors);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

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

    const fetchSkus = useCallback(async () => {
        setIsListLoading(true);
        setListError(null);
        try {
            const res = await skuApi.getList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm.trim() || undefined,
            });
            if (res.isSuccessful && res.data) {
                const records = (res.data.records ?? []).map((row) => ({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    description: row.description ?? undefined,
                }));
                setAllSkus(records);
                const pagination = res.data.pagination;
                setTotalSkuCount(
                    pagination?.totalCount != null ? pagination.totalCount : records.length,
                );
            } else {
                setListError(res.message || "Failed to load SKU list.");
                setAllSkus([]);
                setTotalSkuCount(0);
            }
        } catch {
            setListError("Unable to load SKU records. Please try again.");
            setAllSkus([]);
            setTotalSkuCount(0);
        } finally {
            setIsListLoading(false);
        }
    }, [currentPage, itemsPerPage, debouncedSearchTerm]);

    useEffect(() => {
        void fetchSkus();
    }, [fetchSkus]);

    const loadItemOptions = useCallback(async (): Promise<ItemOption[]> => {
        setIsLoadingItems(true);
        try {
            const mapDropdownResponse = (res: Awaited<ReturnType<typeof commonApi.getItemsDropdown>>) => {
                const records = Array.isArray(res?.data?.records)
                    ? res.data.records
                    : Array.isArray(res?.data)
                      ? res.data
                      : [];
                return records.flatMap((row: { item?: unknown } | Record<string, unknown>): ItemOption[] => {
                    const item = (row as { item?: Record<string, unknown> }).item ?? row;
                    const r = item as Record<string, unknown>;
                    const id = Number(r.id ?? r.item_id);
                    const code = String(r.code ?? r.item_code ?? "").trim();
                    const name = String(r.name ?? r.item_name ?? "").trim();
                    if (!Number.isFinite(id) || id <= 0 || !code || !name) return [];
                    return [{ id, code, name }];
                });
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

            const byId = new Map<number, ItemOption>();
            for (const res of fetchLists) {
                if (!res.isSuccessful) continue;
                for (const row of mapDropdownResponse(res)) {
                    byId.set(row.id, row);
                }
            }

            const options = Array.from(byId.values()).sort((a, b) =>
                a.code.localeCompare(b.code, undefined, { sensitivity: "base" }),
            );
            setItemOptions(options);
            return options;
        } catch (e) {
            console.error("Failed to load FG/SFG items for SKU:", e);
            setItemOptions([]);
            return [];
        } finally {
            setIsLoadingItems(false);
        }
    }, [fgTypeId, sfgTypeId]);

    useEffect(() => {
        if (!isDialogOpen || editingId !== null) return;
        void loadItemOptions();
    }, [isDialogOpen, editingId, loadItemOptions]);

    const itemDropdownOptions = useMemo(
        () =>
            itemOptions.map((item) => ({
                label: `${item.code} — ${item.name}`,
                value: String(item.id),
                primaryText: item.name,
                secondaryText: item.code,
            })),
        [itemOptions],
    );

    const selectedItem = useMemo(
        () => itemOptions.find((i) => String(i.id) === skuFormData.itemId),
        [itemOptions, skuFormData.itemId],
    );

    const totalPages = Math.max(1, Math.ceil(totalSkuCount / itemsPerPage));

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, itemsPerPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const validateSkuForm = (): boolean => {
        const errors: SkuFormErrors = { code: "", name: "" };
        const codeTrimmed = skuFormData.code.trim();
        const nameTrimmed = skuFormData.name.trim();

        if (!codeTrimmed) {
            errors.code = "SKU Code is required";
        } else if (!hasMinTwoChars(codeTrimmed)) {
            errors.code = CODE_NAME_INLINE_ERROR;
        } else if (codeTrimmed.length > SKU_CODE_MAX_LENGTH) {
            errors.code = `SKU Code cannot exceed ${SKU_CODE_MAX_LENGTH} characters`;
        }

        if (!nameTrimmed) {
            errors.name = "SKU Name is required";
        } else if (!hasMinTwoChars(nameTrimmed)) {
            errors.name = CODE_NAME_INLINE_ERROR;
        } else if (nameTrimmed.length > SKU_NAME_MAX_LENGTH) {
            errors.name = `SKU Name cannot exceed ${SKU_NAME_MAX_LENGTH} characters`;
        }

        setSkuFormErrors(errors);
        return !errors.code && !errors.name;
    };

    const resetSkuForm = () => {
        setSkuFormData(emptySkuForm);
        setSkuFormErrors(emptySkuFormErrors);
    };

    const handleAddClick = () => {
        setEditingId(null);
        resetSkuForm();
        setIsDialogOpen(true);
    };

    const handleEditClick = async (sku: SkuRecord) => {
        setEditingId(sku.id);
        setSkuFormErrors(emptySkuFormErrors);
        resetSkuForm();
        setIsDialogOpen(true);
        setIsFormDetailLoading(true);
        try {
            const detailRes = await skuApi.getById(sku.id);

            if (!detailRes.isSuccessful || !detailRes.data) {
                showSkuToast({
                    variant: "destructive",
                    title: "Error",
                    description: detailRes.message || "Failed to load SKU details.",
                });
                setIsDialogOpen(false);
                setEditingId(null);
                return;
            }

            const detail = detailRes.data;
            const linkedItem = itemOptionFromSkuDetail(detail);
            setItemOptions(linkedItem ? [linkedItem] : []);
            setSkuFormData(mapSkuDetailToForm(detail));
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : "Failed to load SKU details.";
            showSkuToast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
            setIsDialogOpen(false);
            setEditingId(null);
        } finally {
            setIsFormDetailLoading(false);
        }
    };

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingId(null);
            setIsFormDetailLoading(false);
            setItemOptions([]);
            resetSkuForm();
        }
    };

    const handleSaveSku = async () => {
        if (!validateSkuForm()) return;

        const code = skuFormData.code.trim();
        const name = skuFormData.name.trim();

        if (editingId !== null) {
            const itemsId = Number(skuFormData.itemId);
            if (!Number.isFinite(itemsId) || itemsId <= 0) {
                showSkuToast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Linked item is missing for this SKU.",
                });
                return;
            }

            setIsSubmitting(true);
            try {
                const res = await skuApi.update(editingId, buildSkuWritePayload(skuFormData, itemsId));
                if (res.isSuccessful) {
                    showSkuToast({
                        title: "SKU Updated",
                        description: res.message || "SKU record updated successfully.",
                        variant: "success",
                    });
                    handleDialogOpenChange(false);
                    void fetchSkus();
                } else {
                    const message = res.message || "Failed to update SKU record.";
                    if (/code|duplicate|exists/i.test(message)) {
                        setSkuFormErrors((prev) => ({ ...prev, code: message }));
                    } else {
                        showSkuToast({
                            variant: "destructive",
                            title: "Error",
                            description: message,
                        });
                    }
                }
            } catch (error: unknown) {
                const message =
                    error instanceof Error ? error.message : "Failed to update SKU record.";
                showSkuToast({
                    variant: "destructive",
                    title: "Error",
                    description: message,
                });
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        const itemsId = Number(skuFormData.itemId);
        if (!Number.isFinite(itemsId) || itemsId <= 0) {
            showSkuToast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please select an item.",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await skuApi.create(buildSkuWritePayload(skuFormData, itemsId));
            if (res.isSuccessful) {
                showSkuToast({
                    title: "SKU Created",
                    description: res.message || "SKU record created successfully.",
                    variant: "success",
                });
                handleDialogOpenChange(false);
                if (currentPage !== 1) {
                    setCurrentPage(1);
                } else {
                    void fetchSkus();
                }
            } else {
                const message = res.message || "Failed to create SKU record.";
                if (/code|duplicate|exists/i.test(message)) {
                    setSkuFormErrors((prev) => ({ ...prev, code: message }));
                } else {
                    showSkuToast({
                        variant: "destructive",
                        title: "Error",
                        description: message,
                    });
                }
            }
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : "Failed to create SKU record.";
            showSkuToast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (id: number) => {
        setSkuToDeleteId(id);
        setIsDeleteAlertOpen(true);
    };

    const confirmDelete = async () => {
        if (skuToDeleteId === null) return;
        setIsDeleting(true);
        try {
            const res = await skuApi.delete(skuToDeleteId);
            if (res.isSuccessful) {
                showSkuToast({
                    title: "Deleted",
                    description: res.message || "SKU record deleted successfully.",
                    variant: "success",
                });
                if (allSkus.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                } else {
                    void fetchSkus();
                }
            } else {
                showSkuToast({
                    variant: "destructive",
                    title: "Error",
                    description: res.message || "Failed to delete SKU record.",
                });
            }
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : "Failed to delete SKU record.";
            showSkuToast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteAlertOpen(false);
            setSkuToDeleteId(null);
        }
    };

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

    const codeFieldError =
        getCodeNameInlineError(skuFormData.code) || skuFormErrors.code || null;
    const nameFieldError =
        getCodeNameInlineError(skuFormData.name) || skuFormErrors.name || null;

    const isSaveDisabled =
        !hasMinTwoChars(skuFormData.code) ||
        !hasMinTwoChars(skuFormData.name) ||
        !!codeFieldError ||
        !!nameFieldError ||
        isSubmitting ||
        isFormDetailLoading ||
        (editingId === null && !skuFormData.itemId);

    return (
        <>
            <AppListToolbar
                search={{
                    placeholder: "Search SKU code or name...",
                    value: searchTerm,
                    onChange: (val: string) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
                }}
                actions={
                    canCreate(permissionKey)
                        ? [
                              {
                                  label: "Create SKU",
                                  icon: <Plus className="mr-2 h-4 w-4" />,
                                  onClick: handleAddClick,
                              },
                          ]
                        : []
                }
            />

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>SKU List</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    <div className="max-w-full overflow-x-auto rounded-md border">
                        <Table className="table-fixed w-full min-w-[800px]">
                            <colgroup>
                                <col className="w-[140px]" />
                                <col className="w-[220px]" />
                                <col className="w-[320px]" />
                                <col className="w-[100px]" />
                            </colgroup>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="align-middle">Code</TableHead>
                                    <TableHead className="align-middle">Name</TableHead>
                                    <TableHead className="align-middle">Description</TableHead>
                                    <TableHead className="sticky right-0 z-20 w-[100px] min-w-[100px] bg-muted/50 text-center align-middle">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    renderListLoadingRow(4)
                                ) : listError ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-24 text-center text-destructive"
                                        >
                                            {listError}
                                        </TableCell>
                                    </TableRow>
                                ) : allSkus.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            No SKU Records Found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    allSkus.map((sku) => (
                                        <TableRow key={sku.id} className="group">
                                            <TableCell className="align-top font-medium wrap-break-word whitespace-normal [word-break:break-word]">
                                                {sku.code}
                                            </TableCell>
                                            <TableCell className="align-top whitespace-normal wrap-break-word [word-break:break-word]">
                                                {sku.name}
                                            </TableCell>
                                            <TableCell className="align-top text-muted-foreground whitespace-normal wrap-break-word [word-break:break-word]">
                                                {sku.description || "—"}
                                            </TableCell>
                                            <TableCell
                                                className={cn(
                                                    "sticky right-0 z-10 w-[100px] min-w-[100px] bg-background text-center align-top",
                                                    "group-hover:bg-muted/50",
                                                )}
                                            >
                                                <TableActionButtons
                                                    onEdit={
                                                        canEdit(permissionKey)
                                                            ? () => handleEditClick(sku)
                                                            : undefined
                                                    }
                                                    onDelete={
                                                        canDelete(permissionKey)
                                                            ? () => handleDeleteClick(sku.id)
                                                            : undefined
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {!isListLoading && !listError && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalSkuCount}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent
                    className="w-[95%] max-w-4xl xl:max-w-5xl max-h-[82vh] overflow-hidden p-0 flex flex-col gap-0 bg-white"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="shrink-0 border-b bg-white px-6 py-5">
                        <DialogHeader className="p-0">
                            <DialogTitle>
                                {editingId ? "Edit SKU" : "Create SKU"}
                            </DialogTitle>
                            <DialogDescription>
                                {editingId
                                    ? "Update the details for this SKU entry."
                                    : "Enter the details for the new SKU entry."}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="relative flex-1 overflow-y-auto px-6 py-5">
                        {isFormDetailLoading && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="sku_code" className="text-xs font-semibold">
                                    SKU Code *
                                </Label>
                                <Input
                                    id="sku_code"
                                    value={skuFormData.code}
                                    maxLength={SKU_CODE_MAX_LENGTH}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSkuFormData((prev) => ({ ...prev, code: val }));
                                        setSkuFormErrors((prev) => ({
                                            ...prev,
                                            code:
                                                prev.code === "SKU Code already exists"
                                                    ? prev.code
                                                    : "",
                                        }));
                                    }}
                                    placeholder="Enter SKU Code"
                                    className={cn(
                                        "h-9 focus-visible:ring-primary",
                                        codeFieldError &&
                                            "border-destructive focus-visible:ring-destructive",
                                    )}
                                    aria-invalid={!!codeFieldError}
                                    disabled={isFormDetailLoading}
                                />
                                {codeFieldError ? (
                                    <p className="text-sm text-destructive">{codeFieldError}</p>
                                ) : null}
                            </div>
                            <SearchableSelect
                                label="Item *"
                                placeholder={isLoadingItems ? "Loading items..." : "Select Item"}
                                value={skuFormData.itemId || undefined}
                                options={itemDropdownOptions}
                                onChange={(val) => {
                                    const s = String(val ?? "").trim();
                                    const itemId = s.includes("|")
                                        ? String(s.split("|").pop() ?? "").trim()
                                        : s;
                                    setSkuFormData((prev) => ({ ...prev, itemId }));
                                }}
                                disabled={isLoadingItems || isFormDetailLoading || editingId !== null}
                                showSelectedTitle
                                compactStackedSelected
                            />
                            <div className="space-y-2">
                                <Label htmlFor="sku_name" className="text-xs font-semibold">
                                    SKU Name *
                                </Label>
                                <Input
                                    id="sku_name"
                                    value={skuFormData.name}
                                    maxLength={SKU_NAME_MAX_LENGTH}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSkuFormData((prev) => ({ ...prev, name: val }));
                                        setSkuFormErrors((prev) => ({ ...prev, name: "" }));
                                    }}
                                    placeholder="Enter SKU Name"
                                    className={cn(
                                        "h-9 focus-visible:ring-primary",
                                        nameFieldError &&
                                            "border-destructive focus-visible:ring-destructive",
                                    )}
                                    aria-invalid={!!nameFieldError}
                                    disabled={isFormDetailLoading}
                                />
                                {nameFieldError ? (
                                    <p className="text-sm text-destructive">{nameFieldError}</p>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku_type" className="text-xs font-semibold">
                                    Type
                                </Label>
                                <Input
                                    id="sku_type"
                                    value={skuFormData.type}
                                    onChange={(e) =>
                                        setSkuFormData((prev) => ({
                                            ...prev,
                                            type: e.target.value,
                                        }))
                                    }
                                    placeholder="Enter Type"
                                    className="h-9 focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku_dimensions" className="text-xs font-semibold">
                                    Dimensions
                                </Label>
                                <Input
                                    id="sku_dimensions"
                                    value={skuFormData.dimensions}
                                    onChange={(e) =>
                                        setSkuFormData((prev) => ({
                                            ...prev,
                                            dimensions: e.target.value,
                                        }))
                                    }
                                    placeholder="Enter Dimensions"
                                    className="h-9 focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku_weight" className="text-xs font-semibold">
                                    Weight
                                </Label>
                                <Input
                                    id="sku_weight"
                                    value={skuFormData.weight}
                                    onChange={(e) =>
                                        setSkuFormData((prev) => ({
                                            ...prev,
                                            weight: e.target.value,
                                        }))
                                    }
                                    placeholder="Enter Weight"
                                    className="h-9 focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="sku_description" className="text-xs font-semibold">
                                    Description
                                </Label>
                                <Textarea
                                    id="sku_description"
                                    value={skuFormData.description}
                                    onChange={(e) =>
                                        setSkuFormData((prev) => ({
                                            ...prev,
                                            description: e.target.value,
                                        }))
                                    }
                                    placeholder="Enter Description"
                                    className="min-h-[80px] w-full resize-none focus-visible:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 border-t bg-white px-6 py-4 mt-auto flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => handleDialogOpenChange(false)}
                            disabled={isSubmitting}
                            className="h-9 px-6 transition-all font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveSku}
                            loading={isSubmitting}
                            disabled={isSaveDisabled}
                            className={cn(
                                "h-9 min-w-[120px] transition-all font-semibold",
                                isSaveDisabled
                                    ? "bg-slate-300 text-slate-600 cursor-not-allowed hover:bg-slate-300 border-none shadow-none"
                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95",
                            )}
                        >
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={isDeleteAlertOpen}
                onOpenChange={(open) => {
                    setIsDeleteAlertOpen(open);
                    if (!open) setSkuToDeleteId(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete SKU</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this SKU record? This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            loading={isDeleting}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
