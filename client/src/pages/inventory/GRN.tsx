import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    FileText,
    Check,
    X,
    CalendarIcon,
    ChevronDown,
    ChevronsUpDown,
    Paperclip,
    Plus,
    Settings2,
    AlertCircle,
    Download,
    LayoutGrid
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

import {
    POStatus,
    MRItem as POItem,
    ReceptionEntry,
    POData,
    getStoredPOs,
    savePOs
} from "@/lib/procurementSharedData";
import { mockWarehouses } from "@/lib/masterMockData";

// ============================================================================
// MOCK DATA
// ============================================================================

// MOCK DATA IS NOW IN lib/procurementSharedData.ts

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

function FormDatePicker({ date, setDate, disabled = false, minDate, blockedDates }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean,
    minDate?: Date,
    blockedDates?: Date[]
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const monthNamesShort = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const formatDisplayDate = (date: Date | undefined) => {
        if (!date) return "Pick a date";
        try {
            return format(date, "dd-MM-yyyy");
        } catch (error) {
            return "Pick a date";
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);

        let isBeforeMinDate = false;
        if (minDate) {
            const minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
            isBeforeMinDate = selected < minimumDate;
        }

        const isBlocked = blockedDates?.some(blockedDate => {
            const blocked = new Date(blockedDate);
            blocked.setHours(0, 0, 0, 0);
            return blocked.getTime() === selected.getTime();
        });

        if (!isBeforeMinDate && !isBlocked) {
            setDate(selectedDate);
            setIsOpen(false);
            setViewMode("day");
        }
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(visibleDate.getFullYear(), monthIndex, 1);
        setVisibleDate(newDate);
        setViewMode("day");
    };

    const handleYearSelect = (year: number) => {
        const newDate = new Date(year, visibleDate.getMonth(), 1);
        setVisibleDate(newDate);
        setViewMode("month");
    };

    const navigateMonth = (direction: number) => {
        const newDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + direction, 1);
        setVisibleDate(newDate);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];
        let minimumDate: Date | null = null;
        if (minDate) {
            minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
        }

        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonth.getDate() - i);
            dayDate.setHours(0, 0, 0, 0);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isPast: minimumDate ? dayDate < minimumDate : false
            });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            const isPast = minimumDate ? currentDate < minimumDate : false;

            const isBlocked = blockedDates?.some(blockedDate => {
                const blocked = new Date(blockedDate);
                blocked.setHours(0, 0, 0, 0);
                return blocked.getTime() === currentDate.getTime();
            });

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected,
                isPast: isPast || isBlocked
            });
        }

        return days;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal h-10 bg-background border-input",
                        !date && "text-muted-foreground"
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDisplayDate(date)}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 bg-popover text-popover-foreground">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => viewMode === "day" ? navigateMonth(-1) : setVisibleDate(new Date(visibleDate.getFullYear() - (viewMode === "year" ? 12 : 1), visibleDate.getMonth(), 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold px-2 h-7"
                                onClick={() => setViewMode(viewMode === "month" ? "day" : "month")}
                            >
                                {monthNames[visibleDate.getMonth()]}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold px-2 h-7"
                                onClick={() => setViewMode(viewMode === "year" ? "day" : "year")}
                            >
                                {visibleDate.getFullYear()}
                            </Button>
                        </div>

                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => viewMode === "day" ? navigateMonth(1) : setVisibleDate(new Date(visibleDate.getFullYear() + (viewMode === "year" ? 12 : 1), visibleDate.getMonth(), 1))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {viewMode === "day" && (
                        <>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                                    <div key={day} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {getDaysInMonth(visibleDate).map((day, idx) => (
                                    <Button
                                        key={idx}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "h-8 w-8 p-0 font-normal",
                                            !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                            day.isToday && "bg-accent text-accent-foreground",
                                            day.isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                                            day.isPast && "text-muted-foreground opacity-20 pointer-events-none"
                                        )}
                                        onClick={() => handleDateSelect(day.date)}
                                        disabled={day.isPast}
                                    >
                                        {day.date.getDate()}
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}

                    {viewMode === "month" && (
                        <div className="grid grid-cols-3 gap-2 p-2">
                            {monthNamesShort.map((month, idx) => (
                                <Button
                                    key={month}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-9 w-full font-normal",
                                        visibleDate.getMonth() === idx && "bg-accent text-accent-foreground"
                                    )}
                                    onClick={() => handleMonthSelect(idx)}
                                >
                                    {month}
                                </Button>
                            ))}
                        </div>
                    )}

                    {viewMode === "year" && (
                        <div className="grid grid-cols-3 gap-2 p-2">
                            {Array.from({ length: 12 }, (_, i) => visibleDate.getFullYear() - 5 + i).map((year) => (
                                <Button
                                    key={year}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-9 w-full font-normal",
                                        visibleDate.getFullYear() === year && "bg-accent text-accent-foreground"
                                    )}
                                    onClick={() => handleYearSelect(year)}
                                >
                                    {year}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// SearchableSelect removed in favor of shared component


function getPOStatusBadge(status: POStatus) {
    switch (status) {
        case "Draft PO": return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none px-3 py-1 text-[10px] font-bold">Draft PO</Badge>;
        case "Submitted PO": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none px-3 py-1 text-[10px] font-bold">Submitted PO</Badge>;
        case "Partially Completed PO": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none px-3 py-1 text-[10px] font-bold">Partially Completed PO</Badge>;
        case "Completed PO": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-3 py-1 text-[10px] font-bold">Completed PO</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
}

// ============================================================================
// MAIN GRN COMPONENT
// ============================================================================

export default function GRN() {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [pos, setPos] = useState<POData[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("Submitted PO");
    const [warehouseFilter, setWarehouseFilter] = useState<string>("All");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    // Pagination state - using DataTablePagination component
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        setPos(getStoredPOs());

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "erp_mock_pos") {
                setPos(getStoredPOs());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const updatePos = (newPos: POData[]) => {
        setPos(newPos);
        savePOs(newPos);
    };

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState<POData | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Reception Form State
    const [receptionForm, setReceptionForm] = useState({
        itemCode: "",
        receivedQty: "",
        deliveryDate: undefined as Date | undefined,
        note: "",
        attachmentName: ""
    });
    const [tempReceptions, setTempReceptions] = useState<ReceptionEntry[]>([]);

    // Filtering
    const filteredPOs = pos.filter(po => {
        const matchesSearch = po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "All" || po.status === statusFilter;
        const matchesWarehouse = warehouseFilter === "All" || po.warehouseName === warehouseFilter;

        let matchesDate = true;
        if (dateFilter) {
            const poDateObj = new Date(po.poDate);
            poDateObj.setHours(0, 0, 0, 0);
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            matchesDate = poDateObj.getTime() === filterDate.getTime();
        }

        const matchesDraft = po.status !== "Draft PO";
        return matchesSearch && matchesStatus && matchesWarehouse && matchesDate && matchesDraft;
    });

    const paginatedPOs = filteredPOs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredPOs.length / itemsPerPage);

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredPOs.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, warehouseFilter, dateFilter]);

    // Handlers
    const handleOpenPO = (po: POData, edit: boolean) => {
        setSelectedPO({ ...po });
        setIsEditMode(edit);
        setTempReceptions([]);
        setReceptionForm({
            itemCode: "",
            receivedQty: "",
            deliveryDate: new Date(),
            note: "",
            attachmentName: ""
        });
        setIsDialogOpen(true);
    };

    const handleDownload = (fileName: string) => {
        toast({ title: "Downloading", description: `Preparing ${fileName} for download...` });

        // Simulate download
        setTimeout(() => {
            const link = document.createElement("a");
            link.href = "#"; // In a real app, this would be the file URL
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: "Success", description: `${fileName} downloaded successfully.` });
        }, 1000);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setReceptionForm(prev => ({ ...prev, attachmentName: file.name }));
        }
    };

    const handleAddReception = () => {
        if (!receptionForm.itemCode || !receptionForm.receivedQty || !receptionForm.deliveryDate) {
            toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }

        const qty = parseFloat(receptionForm.receivedQty);
        if (isNaN(qty) || qty <= 0) {
            toast({ title: "Validation Error", description: "Invalid quantity.", variant: "destructive" });
            return;
        }

        const item = selectedPO?.items.find(i => i.itemCode === receptionForm.itemCode);
        if (!item) return;

        const newEntry: ReceptionEntry = {
            id: Date.now(),
            itemCode: item.itemCode,
            itemName: item.itemName,
            receivedQty: qty,
            deliveryDate: format(receptionForm.deliveryDate, "dd-MM-yyyy"),
            note: receptionForm.note,
            attachmentName: receptionForm.attachmentName
        };

        setTempReceptions(prev => [...prev, newEntry]);

        // Reset form
        setReceptionForm({
            itemCode: "",
            receivedQty: "",
            deliveryDate: new Date(),
            note: "",
            attachmentName: ""
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSaveGRN = () => {
        if (!selectedPO) return;

        // Apply temporary receptions to the PO items and history
        const updatedPOs = pos.map(p => {
            if (p.id === selectedPO.id) {
                // Combine existing receptions with new ones
                const currentReceptions = p.receptions || [];
                const updatedReceptions = [...currentReceptions, ...tempReceptions];

                const updatedItems = p.items.map(item => {
                    const receivedInThisSession = tempReceptions
                        .filter(r => r.itemCode === item.itemCode)
                        .reduce((sum, r) => sum + r.receivedQty, 0);

                    const newTotal = item.qtyReceived + receivedInThisSession;
                    return { ...item, qtyReceived: newTotal };
                });

                // Determine new status
                let newStatus: POStatus = p.status;
                const allReceived = updatedItems.every(i => i.qtyReceived >= i.requiredQty);
                const someReceived = updatedItems.some(i => i.qtyReceived > 0);

                if (allReceived) newStatus = "Completed PO";
                else if (someReceived) newStatus = "Partially Completed PO";

                return {
                    ...p,
                    items: updatedItems,
                    status: newStatus,
                    receptions: updatedReceptions
                };
            }
            return p;
        });

        updatePos(updatedPOs);
        toast({ title: "Success", description: "GRN has been saved and quantities updated." });
        setIsDialogOpen(false);
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Goods Received Note</h1>

            <div className="flex flex-col gap-6">
                <AppListToolbar
                    search={{
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: "Search by PO Number or Vendor..."
                    }}
                    filters={[
                        {
                            type: 'select',
                            label: 'Warehouse',
                            value: warehouseFilter,
                            options: [{ label: "All Warehouses", value: "All" }, ...mockWarehouses.map(wh => wh.name)],
                            onChange: setWarehouseFilter,
                            searchable: true
                        },
                        {
                            type: 'select',
                            label: 'Status',
                            value: statusFilter,
                            options: [
                                { label: "All Statuses", value: "All" },
                                { label: "Submitted PO", value: "Submitted PO" },
                                { label: "Partially Completed PO", value: "Partially Completed PO" },
                                { label: "Completed PO", value: "Completed PO" }
                            ],
                            onChange: setStatusFilter,
                            searchable: true
                        },
                        {
                            type: 'date',
                            label: 'Date',
                            value: dateFilter,
                            onChange: setDateFilter,
                            showClear: true
                        }
                    ]}
                />

                <Card>
                    <CardContent className="pt-6">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">PO No</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">PO Date</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Vendor</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                        <TableHead className="text-center w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedPOs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                                No Purchase Orders found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedPOs.map((po) => (
                                            <TableRow key={po.id} className="hover:bg-muted/30 transition-colors border-b">
                                                <TableCell className="py-4 font-medium font-mono">{po.poNumber}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{po.poDate}</TableCell>
                                                <TableCell className="py-4 text-sm font-bold text-primary">{po.vendorName}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{po.location}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{po.warehouseName}</TableCell>
                                                <TableCell className="py-4 text-center">{getPOStatusBadge(po.status)}</TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <TableActionButtons
                                                        onView={() => handleOpenPO(po, false)}
                                                        onEdit={po.status !== "Completed PO" ? () => handleOpenPO(po, true) : undefined}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination - using standardized DataTablePagination component */}
                        {filteredPOs.length > 0 && (
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={filteredPOs.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                options={[10, 15, 30, 50]}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Config Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[1000px] max-h-[95vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <div className="flex items-center gap-3 mb-1">
                            <Settings2 className="h-5 w-5 text-primary" />
                            <DialogTitle className="text-2xl font-bold">
                                {isEditMode ? "Configure Goods Received:" : "View Goods Received:"} {selectedPO?.poNumber}
                            </DialogTitle>
                        </div>
                        <DialogDescription>
                            Review PO details and record incoming item quantities.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* Read-only Info Grid */}
                        <div className="p-4 bg-muted/30 rounded-lg grid grid-cols-4 gap-4 border">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">PO Date</Label>
                                <p className="text-sm font-medium">{selectedPO?.poDate}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Location</Label>
                                <p className="text-sm font-medium">{selectedPO?.location}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Vendor</Label>
                                <p className="text-sm font-medium">{selectedPO?.vendorName}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</Label>
                                <div className="pt-0.5">{selectedPO && getPOStatusBadge(selectedPO.status)}</div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <Tabs defaultValue="po-items" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="po-items" className="font-bold">PO Items</TabsTrigger>
                                <TabsTrigger value="receive-items" className="font-bold">Receive Items</TabsTrigger>
                            </TabsList>

                            <TabsContent value="po-items" className="space-y-6 outline-none">
                                <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider pl-4">Item</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider">UOM</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider">Price/UOM</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right">Ordered Qty</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right">Received Qty</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right pr-4">Delivery Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedPO?.items.map((item) => {
                                                const stagedEntries = tempReceptions.filter(r => r.itemCode === item.itemCode);
                                                const savedEntries = selectedPO?.receptions?.filter(r => r.itemCode === item.itemCode) || [];
                                                const allEntries = [...savedEntries, ...stagedEntries];

                                                const totalReceived = item.qtyReceived + stagedEntries.reduce((s, r) => s + r.receivedQty, 0);
                                                const latestDeliveryDate = allEntries.length > 0
                                                    ? allEntries[allEntries.length - 1].deliveryDate
                                                    : item.deliveryDate || "-";

                                                return (
                                                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors border-slate-100">
                                                        <TableCell className="py-4 pl-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-xs text-primary">{item.itemCode}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium">{item.itemName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-[9px] text-muted-foreground uppercase font-bold">{item.uom}</TableCell>
                                                        <TableCell className="text-slate-900 font-medium">${item.price || 0}/{item.uom}</TableCell>
                                                        <TableCell className="text-right text-primary font-bold">{item.requiredQty}</TableCell>
                                                        <TableCell className="text-right text-blue-600 font-bold">
                                                            {totalReceived}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500 font-medium pr-4 text-[10px]">
                                                            {latestDeliveryDate}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="receive-items" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                                <div className="space-y-8">
                                    {/* Entry Form */}
                                    {isEditMode && (
                                        <div className="grid grid-cols-12 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                                            <div className="col-span-4">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Item Selection <span className="text-red-500">*</span></Label>
                                                <Select value={receptionForm.itemCode} onValueChange={(v) => setReceptionForm(prev => ({ ...prev, itemCode: v }))}>
                                                    <SelectTrigger className="h-10 bg-white border-slate-200">
                                                        <SelectValue placeholder="Select Item..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {selectedPO?.items.map(i => (
                                                            <SelectItem key={i.id} value={i.itemCode}>
                                                                {i.itemCode} - {i.itemName} (Pending: {i.requiredQty - i.qtyReceived})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-2">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Receive Qty <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    className="h-10 bg-white border-slate-200"
                                                    value={receptionForm.receivedQty}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // Allow only numbers and one decimal point, max 6 digits total
                                                        if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                                            setReceptionForm(prev => ({ ...prev, receivedQty: val }));
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Receive Date <span className="text-red-500">*</span></Label>
                                                <FormDatePicker
                                                    date={receptionForm.deliveryDate}
                                                    setDate={(d) => setReceptionForm(prev => ({ ...prev, deliveryDate: d }))}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Attachment</Label>
                                                <div className="flex items-center gap-3 h-10">
                                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 border-slate-200 bg-white" onClick={() => fileInputRef.current?.click()}>
                                                        <Paperclip className="h-4 w-4" />
                                                    </Button>
                                                    {receptionForm.attachmentName && (
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-medium flex items-center gap-1 max-w-[150px] truncate">
                                                            {receptionForm.attachmentName}
                                                            <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReceptionForm(prev => ({ ...prev, attachmentName: "" }));
                                                                if (fileInputRef.current) fileInputRef.current.value = "";
                                                            }} />
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="col-span-11">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Note/Remarks</Label>
                                                <Input
                                                    placeholder="Add any internal notes..."
                                                    className="h-10 bg-white border-slate-200"
                                                    value={receptionForm.note}
                                                    onChange={(e) => setReceptionForm(prev => ({ ...prev, note: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-span-1 flex items-end">
                                                <Button className="h-10 w-full shadow-lg" onClick={handleAddReception}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* History Table */}
                                    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">New Reception Entries</span>
                                        </div>
                                        <Table>
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider pl-6">Item</TableHead>
                                                    <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider text-right">Qty</TableHead>
                                                    <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Date</TableHead>
                                                    <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Document</TableHead>
                                                    <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Note</TableHead>
                                                    <TableHead className="font-bold text-slate-500 py-3 text-[10px] tracking-wider text-center">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {((selectedPO?.receptions || []).length > 0 || tempReceptions.length > 0) ? (
                                                    <>
                                                        {/* Fixed/Saved History */}
                                                        {selectedPO?.receptions?.map((r) => (
                                                            <TableRow key={r.id} className="hover:bg-slate-50/10 border-slate-50 opacity-80">
                                                                <TableCell className="pl-6">
                                                                    <div className="font-medium text-slate-900">{r.itemCode}</div>
                                                                    <div className="text-[10px] text-slate-400">{r.itemName}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-slate-900">{r.receivedQty}</TableCell>
                                                                <TableCell className="text-slate-600 text-xs">{r.deliveryDate}</TableCell>
                                                                <TableCell>
                                                                    {r.attachmentName ? (
                                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-medium flex items-center gap-1 w-fit">
                                                                            <Paperclip className="h-3 w-3" />
                                                                            {r.attachmentName}
                                                                        </Badge>
                                                                    ) : "-"}
                                                                </TableCell>
                                                                <TableCell className="text-slate-500 text-xs italic">{r.note || "-"}</TableCell>
                                                                <TableCell className="text-right pr-6">
                                                                    {r.attachmentName && (
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50" title="Download Document" onClick={() => handleDownload(r.attachmentName!)}>
                                                                            <Download className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {/* Staged/New entries */}
                                                        {tempReceptions.map((r) => (
                                                            <TableRow key={r.id} className="hover:bg-slate-50/30 border-slate-50 bg-blue-50/10">
                                                                <TableCell className="pl-6">
                                                                    <div className="font-medium text-slate-900">{r.itemCode}</div>
                                                                    <div className="text-[10px] text-slate-400">{r.itemName}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-slate-900">{r.receivedQty}</TableCell>
                                                                <TableCell className="text-slate-600 text-xs">{r.deliveryDate}</TableCell>
                                                                <TableCell>
                                                                    {r.attachmentName ? (
                                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-medium flex items-center gap-1 w-fit">
                                                                            <Paperclip className="h-3 w-3" />
                                                                            {r.attachmentName}
                                                                        </Badge>
                                                                    ) : "-"}
                                                                </TableCell>
                                                                <TableCell className="text-slate-500 text-xs italic">{r.note || "-"}</TableCell>
                                                                <TableCell className="text-right pr-6">
                                                                    <div className="flex justify-end gap-1">
                                                                        {r.attachmentName && (
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50" title="Download" onClick={() => handleDownload(r.attachmentName!)}>
                                                                                <Download className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                        {isEditMode && (
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/5" onClick={() => setTempReceptions(prev => prev.filter(x => x.id !== r.id))}>
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="h-24 text-center text-slate-400 text-sm">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <AlertCircle className="h-5 w-5 opacity-20" />
                                                                No reception history found.
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-6 border-t mt-auto gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button>
                        {isEditMode && (
                            <Button
                                className="font-bold px-8 shadow-md"
                                onClick={handleSaveGRN}
                                disabled={tempReceptions.length === 0}
                            >
                                <Check className="mr-2 h-4 w-4" />
                                Save
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
