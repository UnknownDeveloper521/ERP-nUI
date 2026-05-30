import React, { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format } from "date-fns";
import {
    Search, Eye, CheckCircle, ChevronLeft, ChevronRight, ChevronsUpDown, Check,
    Calendar as CalendarIcon, Download, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInputBorderless,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    WorkerWage,
    WorkerWageStatus,
    mockWorkerWages,
    updateWorkerWage
} from "@/lib/workerPayrollSharedData";
import { workerPaymentsApi, WorkerPaymentRecord } from "@/lib/api";
import { generateWorkerPaymentPDFHTML } from "@/lib/workerPaymentPDFTemplate";
import { commonApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { DataTablePagination } from "@/components/shared/DataTablePagination";



// removed local SearchableSelect helper - using shared one

export default function WorkerPaymentsPage() {
    const { toast } = useToast();

    // State
    const [wages, setWages] = useState<WorkerWage[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedWage, setSelectedWage] = useState<WorkerWage | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [statusFilter, setStatusFilter] = useState<string>("Submitted");
    const [departmentFilter, setDepartmentFilter] = useState<string>("All");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isListLoading, setIsListLoading] = useState(true);
    const [isViewDetailLoading, setIsViewDetailLoading] = useState(false);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);
    const [openingWageId, setOpeningWageId] = useState<string | null>(null);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const { departments, workerPayrollStatuses } = useCommonStore(state => state);
    const departmentOptions = useMemo(() => {
        return ["All", ...(departments || []).map(d => d.name || d.value_name)];
    }, [departments]);

    const statusOptions = useMemo(() => {
        const statuses = (workerPayrollStatuses || [])
            .map(s => s.name)
            .filter(name => name.toLowerCase() !== "draft");
        
        if (statuses.length > 0) return ["All", ...statuses];
        return ["All", "Submitted", "Paid"];
    }, [workerPayrollStatuses]);

    // Fetch Data
    const fetchPayments = async () => {
        setIsListLoading(true);
        try {
            const deptId = (departments || []).find(d => (d.name || d.value_name) === departmentFilter)?.id;
            
            // Resolve status ID from master data (workerPayrollStatuses)
            let statusId: number | undefined = undefined;
            if (statusFilter !== "All") {
                const match = (workerPayrollStatuses || []).find(s => s.name === statusFilter);
                statusId = match?.id;
                
                // Fallback for hardcoded cases if master data isn't fully synced yet
                if (!statusId) {
                    if (statusFilter === "Submitted") statusId = 300;
                    else if (statusFilter === "Paid") statusId = 301;
                }
            }

            const res = await workerPaymentsApi.getPayments({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchQuery,
                department_id: deptId,
                status_id: statusId,
                entry_date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined
            });

            if (res.isSuccessful && res.data) {
                const mappedWages: WorkerWage[] = res.data.records.map((record: WorkerPaymentRecord) => ({
                    id: String(record.worker_payroll_id),
                    wagePeriod: record.wage_period,
                    registerDate: record.entry_date,
                    location: record.location_name,
                    department: record.department_name,
                    workcenter: "",
                    operation: "",
                    workerCategory: record.worker_category_name,
                    noOfWorkers: record.no_of_workers,
                    netWageAmount: record.net_wage_amount,
                    totalWageAmount: record.total_wage_amount,
                    status: record.status_name.toLowerCase().includes("paid") ? "Paid Wages" : "Submitted Wages"
                }));
                setWages(mappedWages);
                setTotalRecords(res.data.pagination.totalRecords);
            }
        } catch (error) {
            console.error("Failed to fetch worker payments:", error);
            toast({
                title: "Error",
                description: "Failed to fetch worker payments data.",
                variant: "destructive"
            });
        } finally {
            setIsListLoading(false);
        }
    };

    const isActionBusy =
        isListLoading ||
        openingWageId !== null ||
        isViewDetailLoading ||
        isMarkingPaid;

    useEffect(() => {
        fetchPayments();
    }, [currentPage, debouncedSearchQuery, statusFilter, departmentFilter, dateFilter, itemsPerPage]);

    // Reset to page 1 when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, statusFilter, departmentFilter, dateFilter]);

    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    const paginatedWages = wages; // Already paginated from API

    // Handlers
    const handleView = async (wage: WorkerWage) => {
        if (isActionBusy) return;
        setOpeningWageId(wage.id);
        setIsViewDetailLoading(true);
        setSelectedWage(wage);
        setIsFormOpen(true);

        try {
            // Call the same listing API but pass worker_payroll_id to get specific details
            const res = await workerPaymentsApi.getPayments({
                page: 1,
                limit: 1,
                worker_payroll_id: wage.id
            });

            if (res.isSuccessful && res.data && res.data.records.length > 0) {
                const record = res.data.records[0];
                const mappedWage: WorkerWage = {
                    id: String(record.worker_payroll_id),
                    wagePeriod: record.wage_period,
                    registerDate: record.entry_date,
                    location: record.location_name,
                    department: record.department_name,
                    workcenter: "",
                    operation: "",
                    workerCategory: record.worker_category_name,
                    noOfWorkers: record.no_of_workers,
                    netWageAmount: record.net_wage_amount,
                    totalWageAmount: record.total_wage_amount,
                    status: record.status_name.toLowerCase().includes("paid") ? "Paid Wages" : "Submitted Wages"
                };
                setSelectedWage(mappedWage);
            }
        } catch (error) {
            console.error("Failed to fetch payment details:", error);
            toast({
                title: "Error",
                description: "Failed to fetch detailed payment information.",
                variant: "destructive"
            });
        } finally {
            setIsViewDetailLoading(false);
            setOpeningWageId(null);
        }
    };

    const handleMarkAsPaid = async () => {
        if (!selectedWage || isActionBusy) return;
        setIsMarkingPaid(true);
        try {
            // Using workerPayrollStatuses to find the correct status_id for 'Paid'
            const paidStatus = (workerPayrollStatuses || []).find(s => s.name.toLowerCase().includes("paid"));
            const status_id = paidStatus?.id || 301; // Fallback to 301

            const res = await workerPaymentsApi.updatePayment(selectedWage.id, { status_id });
            if (res.isSuccessful) {
                toast({ 
                    variant: "success",
                    title: "Success", 
                    description: res.message || "Wage marked as Paid.",
                    duration: 15000
                });
                setIsFormOpen(false);
                fetchPayments(); // Refresh the list
            }
        } catch (error) {
            console.error("Failed to update payment status:", error);
            toast({
                title: "Error",
                description: "Failed to mark wage as paid.",
                variant: "destructive"
            });
        } finally {
            setIsMarkingPaid(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!selectedWage) return;
        
        const htmlContent = generateWorkerPaymentPDFHTML(selectedWage);

        // Use a hidden iframe to print/download
        let iframe = document.getElementById("payment-print-iframe") as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "payment-print-iframe";
            iframe.style.position = "absolute";
            iframe.style.width = "0px";
            iframe.style.height = "0px";
            iframe.style.border = "none";
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Wait for styles and fonts to load
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            }, 500);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Worker Payments</h1>
                <p className="text-muted-foreground">Process and verify worker wage payments</p>
            </div>

            {/* Toolbar */}
            <AppListToolbar
                search={{
                    placeholder: "Search by Period / Dept...",
                    value: searchQuery,
                    onChange: (val) => { setSearchQuery(val); setCurrentPage(1); }
                }}
                filters={[
                    {
                        type: 'select',
                        label: "Department",
                        value: departmentFilter,
                        onChange: (val) => { setDepartmentFilter(val); setCurrentPage(1); },
                        options: departmentOptions,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: "Date",
                        value: dateFilter,
                        onChange: (val) => { setDateFilter(val); setCurrentPage(1); },
                        placeholder: "Pick a date"
                    },
                    {
                        type: 'select',
                        label: "Status",
                        value: statusFilter,
                        onChange: (val) => { setStatusFilter(val); setCurrentPage(1); },
                        options: statusOptions,
                        searchable: true
                    }
                ]}
            />

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Wage Period</TableHead>
                                    <TableHead>Register Date</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="text-center">Workers</TableHead>
                                    <TableHead className="text-right">Total Net Wage</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
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
                                ) : wages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No records found.</TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedWages.map((wage) => (
                                        <TableRow key={wage.id} className="hover:bg-muted/50 transition-colors border-b">
                                            <TableCell className="font-mono text-xs font-semibold py-3">{wage.wagePeriod}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{format(new Date(wage.registerDate), "dd MMM yyyy")}</TableCell>
                                            <TableCell className="text-xs">{wage.department}</TableCell>
                                            <TableCell className="text-center font-medium text-xs font-mono">{wage.noOfWorkers}</TableCell>
                                            <TableCell className="text-right font-bold text-xs font-mono">USh{wage.totalWageAmount.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide border",
                                                    (wage.status as any) === "Submitted Wages" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                )}>
                                                    {wage.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold text-xs gap-2"
                                                    onClick={() => handleView(wage)}
                                                    disabled={isActionBusy}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    {(wage.status as any) === "Submitted Wages" && "Process"}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalRecords > 0 && !isListLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalRecords}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    )}
                </CardContent>
            </Card>

            {/* View/Process Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent 
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="border-b bg-white p-4 sm:p-6">
                        <DialogTitle className="text-xl">Worker Wage Details</DialogTitle>
                        <DialogDescription>Review payroll information before marking as paid.</DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 space-y-6">
                        <div className="relative">
                            {isViewDetailLoading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-md">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            )}
                            {selectedWage && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Wage Period</Label>
                                        <Input value={selectedWage.wagePeriod} readOnly className="h-9 bg-muted/50" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Register Date</Label>
                                        <Input value={format(new Date(selectedWage.registerDate), "dd-MM-yyyy")} readOnly className="h-9 bg-muted/50" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Location</Label>
                                        <Input value={selectedWage.location || "-"} readOnly className="h-9 bg-muted/50" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Department</Label>
                                        <Input value={selectedWage.department || "-"} readOnly className="h-9 bg-muted/50" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Worker Category</Label>
                                        <Input value={selectedWage.workerCategory} readOnly className="h-9 bg-muted/50" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">No of Workers</Label>
                                        <Input value={selectedWage.noOfWorkers} readOnly className="h-9 bg-muted/50 font-mono tabular-nums" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Net Wage Amount</Label>
                                        <Input value={`USh${selectedWage.netWageAmount}`} readOnly className="h-9 bg-muted/50 font-mono tabular-nums" />
                                    </div>

                                    <div className="lg:col-span-3">
                                        <div className="rounded-lg border bg-muted/20 p-4 sm:p-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                                                        Total Wage Amount
                                                    </Label>
                                                    <div className="text-2xl font-bold text-primary tabular-nums">
                                                        USh{selectedWage.totalWageAmount.toLocaleString()}
                                                    </div>
                                                </div>
                                                <Badge className="bg-blue-50 text-blue-700 border border-blue-100">
                                                    {selectedWage.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="border-t bg-white p-4 sm:p-6 mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 no-print">
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                            Close
                        </Button>
                        {(selectedWage?.status as any) === "Paid Wages" && (
                            <Button onClick={handleDownloadPDF} variant="outline" className="border-primary text-primary hover:bg-primary/5">
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </Button>
                        )}
                        {(selectedWage?.status as any) === "Submitted Wages" && (
                            <Button
                                onClick={handleMarkAsPaid}
                                loading={isMarkingPaid}
                                disabled={isViewDetailLoading || isMarkingPaid}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// removed local DatePicker component - using shared one
