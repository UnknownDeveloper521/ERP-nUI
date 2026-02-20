import { useState } from "react";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface LedgerEntry {
    id: number;
    date: string;
    type: "Issue" | "GRN";
    refNo: string;
    itemCode: string;
    itemName: string;
    qty: number;
    uom: string;
    warehouse: string;
    user: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_LEDGER_ENTRIES: LedgerEntry[] = [
    { id: 1, date: "2024-02-15", type: "Issue", refNo: "MR-2024-001", itemCode: "RM-STL-001", itemName: "Steel Sheet 2mm", qty: 100, uom: "KG", warehouse: "Main Store", user: "Admin" },
    { id: 2, date: "2024-02-15", type: "Issue", refNo: "MR-2024-001", itemCode: "RM-ALU-002", itemName: "Aluminum Plate", qty: 30, uom: "KG", warehouse: "Main Store", user: "Admin" },
    { id: 3, date: "2024-02-16", type: "GRN", refNo: "GRN-2024-101", itemCode: "RM-STL-001", itemName: "Steel Sheet 2mm", qty: 500, uom: "KG", warehouse: "Main Store", user: "Inventory Mgr" },
    { id: 4, date: "2024-02-17", type: "Issue", refNo: "MR-2024-003", itemCode: "RM-SCR-004", itemName: "Screws M4", qty: 500, uom: "NOS", warehouse: "Production Store", user: "John Doe" },
    { id: 5, date: "2024-02-18", type: "GRN", refNo: "GRN-2024-102", itemCode: "RM-WLD-003", itemName: "Welding Rods", qty: 100, uom: "PKT", warehouse: "Main Store", user: "Admin" },
];

const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MaterialLedger() {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const totalPages = Math.ceil(MOCK_LEDGER_ENTRIES.length / itemsPerPage);
    const paginatedLedger = MOCK_LEDGER_ENTRIES.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Material Ledger</h1>
                <p className="text-muted-foreground">View-only log of material issues and GRNs.</p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Type</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Ref No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Item Details</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Qty</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider pr-6">Processed By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLedger.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLedger.map((entry) => (
                                        <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4">{formatDate(entry.date)}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium",
                                                        entry.type === "Issue" ? "border-amber-500 text-amber-600 bg-amber-50" : "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {entry.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium text-primary">{entry.refNo}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{entry.itemName}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-tight">{entry.itemCode}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {entry.qty} <span className="text-[10px] text-muted-foreground ml-0.5">{entry.uom}</span>
                                            </TableCell>
                                            <TableCell>{entry.warehouse}</TableCell>
                                            <TableCell className="pr-6">{entry.user}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {MOCK_LEDGER_ENTRIES.length > 0 && (
                        <div className="flex justify-between items-center px-1 mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, MOCK_LEDGER_ENTRIES.length)} of {MOCK_LEDGER_ENTRIES.length} entries
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages || totalPages === 0}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
