import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar, FilterField } from "@/components/shared/AppListToolbar";
import { cn } from "@/lib/utils";
import { commonApi, inventoryApi, type MaterialLedgerRecord } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface LedgerEntry {
    id: number;
    date: string;
    type: string;
    refNo: string;
    itemCode: string;
    itemName: string;
    qty: number;
    uom: string;
    warehouse: string;
    qtyBalance: number;
}

const formatDisplayDate = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return String(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

const mapLedgerRecord = (r: MaterialLedgerRecord): LedgerEntry => {
    const rawType = String(r.transaction_type || "").trim();
    const typeUpper = rawType.toUpperCase();
    const displayType =
        typeUpper === "ISSUE" || typeUpper === "ISSUED" ? "Issue" : rawType || "—";

    return {
        id: r.id,
        date: r.transaction_date,
        type: displayType,
        refNo: r.reference_code?.trim() ? r.reference_code.trim() : "—",
        itemCode: r.item_code || "—",
        itemName: r.item_name || "—",
        qty: Number(r.qty) || 0,
        uom: r.uom_name || "",
        warehouse: r.warehouse_name || "—",
        qtyBalance: Number(r.balance_qty) || 0,
    };
};

const isIssueType = (type: string): boolean => {
    const t = type.trim().toUpperCase();
    return t === "ISSUE" || t === "ISSUED";
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MaterialLedger() {
    const { toast } = useToast();
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
    const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
    const [areListFiltersReady, setAreListFiltersReady] = useState(false);
    const appliedWarehouseFilterDefault = useRef(false);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const assignedWarehouseKey = getAssignedIds("warehouse").join(",");
    const orderedWarehouses = useMemo(
        () => prioritizeByAssigned(warehouses, getAssignedIds("warehouse"), (wh) => wh.id),
        [warehouses, assignedWarehouseKey]
    );

    useEffect(() => {
        let cancelled = false;
        const fetchWarehouses = async () => {
            const assignedWarehouseIds = getAssignedIds("warehouse");
            try {
                const res = await commonApi.getWarehouses();
                if (cancelled) return;
                if (res.isSuccessful && res.data?.records) {
                    const warehouseRecords = res.data.records
                        .map((wh: Record<string, unknown>) => ({
                            id: Number(wh.id ?? wh.warehouse_id),
                            name: String(
                                wh.warehouse_name ?? wh.name ?? wh.value_name ?? "Unknown Warehouse"
                            ).trim(),
                        }))
                        .filter((wh: { id: number; name: string }) => Number.isFinite(wh.id) && wh.name);

                    setWarehouses(warehouseRecords);

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
                            setWarehouseFilter(String(firstAssigned));
                            appliedWarehouseFilterDefault.current = true;
                        }
                    }
                } else {
                    setWarehouses([]);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to fetch warehouses:", error);
                    setWarehouses([]);
                }
            } finally {
                if (!cancelled) {
                    setAreListFiltersReady(true);
                }
            }
        };
        void fetchWarehouses();
        return () => {
            cancelled = true;
        };
    }, []);

    const fetchLedger = useCallback(async () => {
        if (!areListFiltersReady) return;
        setIsLoading(true);
        const warehouseId =
            warehouseFilter === "all"
                ? undefined
                : (() => {
                      const n = Number(warehouseFilter);
                      return Number.isFinite(n) ? n : undefined;
                  })();

        try {
            const res = await inventoryApi.getMaterialLedgerList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm.trim() || undefined,
                transaction_date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
                warehouse_id: warehouseId,
            });

            if (res.isSuccessful && res.data) {
                setEntries((res.data.records || []).map(mapLedgerRecord));
                const pagination = res.data.pagination;
                setTotalRecords(
                    pagination?.totalCount ??
                        pagination?.totalRecords ??
                        res.data.records?.length ??
                        0
                );
            } else {
                setEntries([]);
                setTotalRecords(0);
                toast({
                    title: "Error",
                    description: res.message || "Failed to load material ledger",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Failed to fetch material ledger:", error);
            setEntries([]);
            setTotalRecords(0);
            toast({
                title: "Error",
                description: "Failed to load material ledger",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [
        areListFiltersReady,
        currentPage,
        itemsPerPage,
        debouncedSearchTerm,
        selectedDate,
        warehouseFilter,
        toast,
    ]);

    useEffect(() => {
        void fetchLedger();
    }, [fetchLedger]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, selectedDate, warehouseFilter]);

    const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / itemsPerPage) : 0;

    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalRecords, currentPage, totalPages]);

    const warehouseOptions = useMemo(
        () => [
            { value: "all", label: "All Warehouse" },
            ...orderedWarehouses.map((wh) => ({ value: String(wh.id), label: wh.name })),
        ],
        [orderedWarehouses]
    );

    const filterFields: FilterField[] = [
        {
            type: "select",
            label: "Warehouse",
            value: warehouseFilter,
            onChange: setWarehouseFilter,
            options: warehouseOptions,
            searchable: true,
        },
        {
            type: "date",
            label: "Date",
            value: selectedDate,
            onChange: setSelectedDate,
            placeholder: "Filter by date",
            showClear: true,
        },
    ];

    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Material Ledger</h1>
                <p className="text-muted-foreground">View-only log of material issues and GRNs.</p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <AppListToolbar
                        search={{
                            value: searchTerm,
                            onChange: setSearchTerm,
                            placeholder: "Search item name, ref code...",
                        }}
                        filters={filterFields}
                    />

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Type</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Ref Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Item Details</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Qty</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Qty Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : entries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    entries.map((entry) => (
                                        <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4">{formatDisplayDate(entry.date)}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium",
                                                        isIssueType(entry.type)
                                                            ? "border-amber-500 text-amber-600 bg-amber-50"
                                                            : "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {entry.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium text-primary">{entry.refNo}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{entry.itemName}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                                    {entry.itemCode}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {entry.qty}{" "}
                                                <span className="text-[10px] text-muted-foreground ml-0.5">
                                                    {entry.uom}
                                                </span>
                                            </TableCell>
                                            <TableCell>{entry.warehouse}</TableCell>
                                            <TableCell className="text-right font-medium pr-6">
                                                {entry.qtyBalance}{" "}
                                                <span className="text-[10px] text-muted-foreground ml-0.5">
                                                    {entry.uom}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalRecords > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalRecords}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={(n) => {
                                setItemsPerPage(n);
                                setCurrentPage(1);
                            }}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
