import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import {
    Search, Eye, CheckCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, Check,
    Calendar as CalendarIcon, X, Download, FileText
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    WorkerWage,
    WorkerWageStatus,
    mockWorkerWages,
    updateWorkerWage
} from "@/lib/workerPayrollSharedData";



// Helper Component: Searchable Select
interface SearchableOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    label?: string;
    value?: string;
    options: (string | SearchableOption)[];
    onValueChange?: (val: string) => void;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
}

function SearchableSelect({
    label,
    value,
    options,
    onValueChange,
    disabled = false,
    placeholder,
    searchPlaceholder
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    const normalizedOptions = useMemo(() => {
        return options.map(opt =>
            typeof opt === 'string' ? { value: opt, label: opt } : opt
        );
    }, [options]);

    const displayValue = useMemo(() => {
        if (!value) return "";
        return normalizedOptions.find(opt => opt.value === value)?.label || value;
    }, [value, normalizedOptions]);

    return (
        <div className="space-y-2">
            {label && <Label className="text-sm font-medium">{label}</Label>}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-10 font-normal border-input"
                        disabled={disabled}
                    >
                        <span className={cn(!value && "text-muted-foreground", "truncate")}>
                            {displayValue || placeholder || `Select ${label}`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInputBorderless placeholder={searchPlaceholder || "Search..."} className="h-9" />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {normalizedOptions.map((item) => (
                                    <CommandItem
                                        key={item.value}
                                        value={item.value}
                                        onSelect={() => {
                                            if (onValueChange) onValueChange(item.value);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />
                                        {item.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

export default function WorkerPaymentsPage() {
    const { toast } = useToast();

    // State
    const [wages, setWages] = useState<WorkerWage[]>(mockWorkerWages);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedWage, setSelectedWage] = useState<WorkerWage | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("Submitted Wages");
    const [departmentFilter, setDepartmentFilter] = useState<string>("All");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filtered Data
    const filteredWages = wages.filter(w => {
        const matchesSearch =
            w.wagePeriod.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.department.toLowerCase().includes(searchQuery.toLowerCase());

        // Accounting only sees Submitted and Paid
        const allowedStatuses = ["Submitted Wages", "Paid Wages"];
        if (!allowedStatuses.includes(w.status)) return false;

        const matchesStatus = statusFilter === "All" || w.status === statusFilter;
        const matchesDepartment = departmentFilter === "All" || w.department === departmentFilter;
        const matchesDate = !dateFilter || format(new Date(w.registerDate), "yyyy-MM-dd") === format(dateFilter, "yyyy-MM-dd");

        return matchesSearch && matchesStatus && matchesDepartment && matchesDate;
    });

    const paginatedWages = filteredWages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredWages.length / itemsPerPage);

    // Handlers
    const handleView = (wage: WorkerWage) => {
        setSelectedWage(wage);
        setIsFormOpen(true);
    };

    const handleMarkAsPaid = () => {
        if (!selectedWage) return;
        const updatedWages = updateWorkerWage(selectedWage.id, { status: "Paid Wages" });
        setWages(updatedWages);
        toast({ title: "Success", description: "Wage marked as Paid." });
        setIsFormOpen(false);
    };

    const handleDownloadPDF = () => {
        if (!selectedWage) return;
        window.print();
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Worker Payments</h1>
                <p className="text-muted-foreground">Process and verify worker wage payments</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Period / Dept..."
                            className="pl-9 h-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</Label>
                    <SearchableSelect
                        value={departmentFilter}
                        onValueChange={setDepartmentFilter}
                        options={["All", "Production", "Logistics", "Packaging", "Maintenance"]}
                    />
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</Label>
                    <DatePicker date={dateFilter} setDate={setDateFilter} />
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                    <SearchableSelect
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                        options={["All", "Submitted Wages", "Paid Wages"]}
                    />
                </div>
            </div>

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
                                    <TableHead className="text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedWages.length === 0 ? (
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
                                            <TableCell className="text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-2",
                                                        wage.status === "Submitted Wages" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                    )}
                                                >
                                                    {wage.status === "Submitted Wages" ? "Submitted" : "Paid"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleView(wage)}
                                                    className="h-8 text-primary hover:bg-primary/5 font-semibold text-xs"
                                                >
                                                    <Eye className="mr-2 h-3.5 w-3.5" />
                                                    {wage.status === "Submitted Wages" ? "Process" : "View"}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Simple Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View/Process Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4 mb-4">
                        <DialogTitle className="text-xl">Worker Wage Details</DialogTitle>
                        <DialogDescription>Review payroll information before marking as paid.</DialogDescription>
                    </DialogHeader>

                    {selectedWage && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Wage Period</Label>
                                <Input value={selectedWage.wagePeriod} readOnly className="h-10 bg-muted" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Register Date</Label>
                                <Input value={format(new Date(selectedWage.registerDate), "dd-MM-yyyy")} readOnly className="h-10 bg-muted" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Location</Label>
                                <Input value={selectedWage.location || "-"} readOnly className="h-10 bg-muted" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Department</Label>
                                <Input value={selectedWage.department || "-"} readOnly className="h-10 bg-muted" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Worker Category</Label>
                                <Input value={selectedWage.workerCategory} readOnly className="h-10 bg-muted" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">No of Workers</Label>
                                <Input value={selectedWage.noOfWorkers} readOnly className="h-10 bg-muted font-mono" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Net Wage Amount</Label>
                                <Input value={`USh${selectedWage.netWageAmount}`} readOnly className="h-10 bg-muted font-mono" />
                            </div>
                            <div className="lg:col-span-1 pt-2">
                                <Label className="text-sm font-semibold text-primary">Total Wage Amount</Label>
                                <div className="text-2xl font-bold text-primary px-3 py-2 bg-primary/5 rounded-md border border-primary/20">
                                    USh{selectedWage.totalWageAmount.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="border-t pt-4 mt-4 flex justify-end gap-3 no-print">
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>Close</Button>
                        {selectedWage?.status === "Paid Wages" && (
                            <Button onClick={handleDownloadPDF} variant="outline" className="border-primary text-primary hover:bg-primary/5">
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </Button>
                        )}
                        {selectedWage?.status === "Submitted Wages" && (
                            <Button onClick={handleMarkAsPaid} className="bg-emerald-600 hover:bg-emerald-700">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                            </Button>
                        )}
                    </DialogFooter>

                    {/* Hidden Print Content */}
                    {selectedWage && (
                        <div className="hidden print:block p-8 space-y-8 bg-white text-black min-h-screen">
                            <div className="flex justify-between items-start border-b-2 border-primary pb-6">
                                <div>
                                    <h1 className="text-3xl font-bold text-primary">WORKER PAYMENT VOUCHER</h1>
                                    <p className="text-muted-foreground mt-1 uppercase tracking-widest text-sm">Official Record of Wage Payment</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">Voucher #: {selectedWage.id}</p>
                                    <p className="text-sm">Printed on: {format(new Date(), "dd MMM yyyy HH:mm")}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12 mt-8">
                                <div className="space-y-4">
                                    <div className="border-l-4 border-primary pl-4">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Wage Period</p>
                                        <p className="text-lg font-semibold">{selectedWage.wagePeriod}</p>
                                    </div>
                                    <div className="border-l-4 border-primary pl-4">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Department</p>
                                        <p className="text-lg font-semibold">{selectedWage.department || "-"}</p>
                                    </div>
                                    <div className="border-l-4 border-primary pl-4">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Location</p>
                                        <p className="text-lg font-semibold">{selectedWage.location || "-"}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="border-l-4 border-primary pl-4">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Registration Date</p>
                                        <p className="text-lg font-semibold">{format(new Date(selectedWage.registerDate), "dd MMMM yyyy")}</p>
                                    </div>
                                    <div className="border-l-4 border-primary pl-4">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Worker Category</p>
                                        <p className="text-lg font-semibold">{selectedWage.workerCategory}</p>
                                    </div>
                                    <div className="border-l-4 border-primary pl-4">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">No. of Workers</p>
                                        <p className="text-lg font-semibold">{selectedWage.noOfWorkers}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 bg-primary/5 p-8 rounded-xl border-2 border-primary/20">
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <p className="text-xs uppercase font-bold text-primary tracking-widest">Payment Amount Summary</p>
                                        <p className="text-sm text-muted-foreground font-medium">Net Wage per Worker: USh{selectedWage.netWageAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm uppercase font-bold text-primary tracking-widest mb-1">Total Net Wage Amount</p>
                                        <p className="text-4xl font-black text-primary">USh{selectedWage.totalWageAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-24 grid grid-cols-3 gap-12 pt-12 border-t border-dashed border-muted-foreground/30">
                                <div className="text-center space-y-4">
                                    <div className="h-0.5 bg-black/20 w-full mx-auto"></div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest">Requested By</p>
                                </div>
                                <div className="text-center space-y-4">
                                    <div className="h-0.5 bg-black/20 w-full mx-auto"></div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest">Verified By (HR)</p>
                                </div>
                                <div className="text-center space-y-4">
                                    <div className="h-0.5 bg-black/20 w-full mx-auto"></div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest">Approved By (Accounts)</p>
                                </div>
                            </div>

                            <div className="absolute bottom-8 left-8 right-8 flex justify-between text-[8px] text-muted-foreground uppercase tracking-[0.2em]">
                                <p>Master ERP System - Financial Module</p>
                                <p>System Generated Document</p>
                                <p>Confidential</p>
                            </div>

                            <style dangerouslySetInnerHTML={{
                                __html: `
                                @media print {
                                    body * { visibility: hidden; }
                                    .print\\:block, .print\\:block * { visibility: visible; }
                                    .print\\:block { 
                                        position: absolute; 
                                        left: 0; 
                                        top: 0; 
                                        width: 100%; 
                                        height: 100%;
                                        margin: 0;
                                        padding: 40px;
                                    }
                                    .no-print { display: none !important; }
                                }
                            `}} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Reusable DatePicker
function DatePicker({ date, setDate }: { date?: Date, setDate: (d?: Date) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        for (let i = firstDay.getDay() - 1; i >= 0; i--) days.push({ date: new Date(year, month - 1, new Date(year, month, 0).getDate() - i), isCurrentMonth: false });
        for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        while (days.length % 7 !== 0) days.push({ date: new Date(year, month + 1, days.length - lastDay.getDate() - firstDay.getDay() + 2), isCurrentMonth: false });
        return days;
    };

    const renderDayView = () => (
        <div className="w-80 p-4">
            <div className="flex justify-between items-center mb-4">
                <Button variant="ghost" size="icon" onClick={() => setVisibleDate(new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setViewMode("month")}>{monthNames[visibleDate.getMonth()]}</Button>
                    <Button variant="ghost" onClick={() => setViewMode("year")}>{visibleDate.getFullYear()}</Button>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setVisibleDate(new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-bold mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(visibleDate).map((d, i) => (
                    <Button
                        key={i}
                        variant="ghost"
                        className={cn("h-8 w-8 p-0 text-sm", !d.isCurrentMonth && "text-muted-foreground opacity-50", date?.toDateString() === d.date.toDateString() && "bg-primary text-primary-foreground")}
                        onClick={() => { setDate(d.date); setIsOpen(false); }}
                    >
                        {d.date.getDate()}
                    </Button>
                ))}
            </div>
        </div>
    );

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                {viewMode === "day" ? renderDayView() : viewMode === "month" ? (
                    <div className="grid grid-cols-3 gap-2 p-4 w-80">
                        {monthNamesShort.map((m, i) => (
                            <Button key={m} variant="ghost" onClick={() => { setVisibleDate(new Date(visibleDate.getFullYear(), i, 1)); setViewMode("day"); }}>{m}</Button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 p-4 w-80 h-60 overflow-y-auto">
                        {Array.from({ length: 50 }, (_, i) => 2020 + i).map(y => (
                            <Button key={y} variant="ghost" onClick={() => { setVisibleDate(new Date(y, visibleDate.getMonth(), 1)); setViewMode("month"); }}>{y}</Button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
