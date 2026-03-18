import React, { useState, useEffect, useRef } from "react";
import { format, parse, isValid } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    FileText,
    Calendar as CalendarIcon,
    ChevronDown,
    Trash2,
    Settings2,
    Paperclip,
    Plus,
    Check,
    Package,
    Printer,
    Download,
    ChevronsUpDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { mockWarehouses, mockLocations, mockTransporters } from "@/lib/masterMockData";

import {
    MRStatus,
    POStatus,
    Quotation,
    MRItem,
    MRRequestData,
    POData,
    getStoredMRs,
    saveMRs,
    getStoredPOs,
    savePOs
} from "@/lib/procurementSharedData";

// ============================================================================
// HELPERS
// ============================================================================

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

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
        case 'pending approval': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'ordered': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'partially received': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'received': return 'bg-teal-50 text-teal-700 border-teal-200';
        case 'closed': return 'bg-gray-50 text-gray-700 border-gray-200';
        case 'cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};

const formatDate = (date: Date | string): string => {
    if (!date) return "";
    const d = typeof date === 'string' ? parseDateString(date) : date;
    if (!isValid(d)) return typeof date === 'string' ? date : "";
    return format(d, "dd-MM-yyyy");
};

const getPOStatusBadge = (status: POStatus) => {
    switch (status) {
        case "Draft PO": return <Badge className="bg-slate-500 hover:bg-slate-600">Draft PO</Badge>;
        case "Submitted PO": return <Badge className="bg-blue-500 hover:bg-blue-600">Submitted PO</Badge>;
        case "Partially Completed PO": return <Badge className="bg-orange-500 hover:bg-orange-600">Partially Completed PO</Badge>;
        case "Completed PO": return <Badge className="bg-green-500 hover:bg-green-600">Completed PO</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

function DatePicker({ date, setDate, disabled = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
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
        setDate(selectedDate);
        setIsOpen(false);
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
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), isCurrentMonth: false });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday: today.toDateString() === currentDate.toDateString(),
                isSelected: date && currentDate.toDateString() === date.toDateString(),
                isDisabled: false
            });
        }

        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const currentDate = new Date(year, month + 1, day);
            days.push({
                date: currentDate,
                isCurrentMonth: false,
                isDisabled: false
            });
        }
        return days;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-[9999]" align="start" side="bottom" sideOffset={4}>
                <div className="w-80">
                    <div className="flex items-center justify-between mb-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{monthNames[visibleDate.getMonth()]} {visibleDate.getFullYear()}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(visibleDate).map((day, index) => (
                            <Button
                                key={index}
                                variant="ghost"
                                size="icon"
                                disabled={(day as any).isDisabled}
                                className={cn(
                                    "h-8 w-8 text-sm font-normal",
                                    !day.isCurrentMonth && "text-muted-foreground opacity-30",
                                    (day as any).isToday && "bg-accent text-accent-foreground font-semibold",
                                    (day as any).isSelected && "bg-primary text-primary-foreground font-semibold",
                                    day.isCurrentMonth && !(day as any).isDisabled && "hover:bg-accent hover:text-accent-foreground",
                                    (day as any).isDisabled && "cursor-not-allowed opacity-20"
                                )}
                                onClick={() => !(day as any).isDisabled && handleDateSelect(day.date)}
                            >
                                {day.date.getDate()}
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

const PO = () => {
    const { toast } = useToast();

    const [requests, setRequests] = useState<MRRequestData[]>([]);

    useEffect(() => {
        setRequests(getStoredMRs());

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "erp_mock_mrs") {
                setRequests(getStoredMRs());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const updateRequests = (newRequests: MRRequestData[]) => {
        setRequests(newRequests);
        saveMRs(newRequests);
    };

    const [pos, setPos] = useState<POData[]>([]);

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

    const [poSearchTerm, setPoSearchTerm] = useState("");
    const [poFilterDate, setPoFilterDate] = useState<Date | undefined>(undefined);
    const [poFilterWarehouse, setPoFilterWarehouse] = useState<string>("all");
    const [poFilterStatus, setPoFilterStatus] = useState<string>("Draft PO");

    const [isPODialogOpen, setIsPODialogOpen] = useState(false);
    const [activePO, setActivePO] = useState<POData | null>(null);
    const [isPOEdit, setIsPOEdit] = useState(false);
    const [isDeletePOAlertOpen, setIsDeletePOAlertOpen] = useState(false);
    const [poToDeleteRecord, setPoToDeleteRecord] = useState<POData | null>(null);
    const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);


    const handleOpenPO = (po: POData, isEdit: boolean) => {
        const poCopy = JSON.parse(JSON.stringify(po)) as POData;
        setActivePO(poCopy);
        setIsPOEdit(isEdit);
        setIsPODialogOpen(true);
    };

    const handleDeletePO = (poId: number) => {
        const poToDelete = pos.find(p => p.id === poId);
        if (!poToDelete) return;

        updatePos(pos.filter(p => p.id !== poId));

        const updatedRequests = requests.map(mr => {
            if (mr.mrCode === poToDelete.mrCode) {
                const updatedItems = mr.items.map(item => {
                    if (poToDelete.items.some(poi => poi.id === item.id)) {
                        return { ...item, poNumber: undefined };
                    }
                    return item;
                });

                const hasPendingItems = updatedItems.some(i => !i.poNumber);
                let newStatus = mr.status;
                if (hasPendingItems && (mr.status === "FullFilled MR" || mr.status === "MR in Fullfillment")) {
                    newStatus = "Requested MR";
                }

                return { ...mr, items: updatedItems, status: newStatus };
            }
            return mr;
        });
        updateRequests(updatedRequests);

        setIsPODialogOpen(false);
        toast({
            title: "PO Deleted",
            description: `Purchase Order ${poToDelete.poNumber} has been deleted and MR items have been reset.`,
        });
    };

    const savePO = () => {
        if (!activePO) return;
        const updatedPO: POData = { ...activePO, status: "PO Confirmed" as POStatus };
        updatePos(pos.map((p: POData) => p.id === updatedPO.id ? updatedPO : p));
        setIsPODialogOpen(false);
        toast({ title: "PO Saved", description: `Purchase Order ${updatedPO.poNumber} confirmed.` });
    };

    const handlePrintPO = () => {
        const printContent = document.getElementById('printable-po-content');
        if (printContent) {
            let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'print-iframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }

            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write('<html><head><title>Purchase Order</title>');
                doc.write('<style>');
                doc.write('body { font-family: sans-serif; padding: 20px; }');
                doc.write('.header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }');
                doc.write('.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }');
                doc.write('.label { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; }');
                doc.write('.value { font-size: 14px; margin-top: 4px; font-weight: 500; }');
                doc.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
                doc.write('th, td { border: 1px solid #eee; padding: 12px; text-align: left; }');
                doc.write('th { background: #f9f9f9; font-size: 11px; text-transform: uppercase; }');
                doc.write('td { font-size: 12px; }');
                doc.write('.footer { margin-top: 50px; text-align: right; font-size: 10px; color: #999; }');
                doc.write('.hidden { display: none; }');
                doc.write('</style></head><body>');
                doc.write(printContent.innerHTML);
                doc.write('</body></html>');
                doc.close();

                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                }, 500);
            }
        }
    };

    const handleDownloadQuotation = (attachmentName: string) => {
        const blob = new Blob(["This is a dummy file content for " + attachmentName], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = attachmentName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
            title: "Download Started",
            description: `Downloading ${attachmentName}...`
        });
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
            </div>

            <AppListToolbar
                search={{
                    value: poSearchTerm,
                    onChange: setPoSearchTerm,
                    placeholder: "Search by PO#, Vendor or Warehouse..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Warehouse',
                        value: poFilterWarehouse,
                        options: [{ label: "All Warehouses", value: "all" }, ...Array.from(new Set(pos.map(po => po.warehouseName)))],
                        onChange: setPoFilterWarehouse,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: poFilterDate,
                        onChange: setPoFilterDate,
                        showClear: !!poFilterDate
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: poFilterStatus,
                        options: [{ label: "All Status", value: "all" }, "Draft PO", "Submitted PO", "Partially Completed PO", "Completed PO"],
                        onChange: setPoFilterStatus,
                        searchable: true
                    }
                ]}
                actions={[
                    {
                        label: "Create PO",
                        icon: <Plus className="h-4 w-4" />,
                        onClick: () => setIsCreatePOOpen(true)
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
                                {pos.filter(po => {
                                    const matchesSearch = po.poNumber.toLowerCase().includes(poSearchTerm.toLowerCase()) ||
                                        po.department.toLowerCase().includes(poSearchTerm.toLowerCase());
                                    const matchesWarehouse = poFilterWarehouse === "all" || po.warehouseName === poFilterWarehouse;
                                    const matchesStatus = poFilterStatus === "all" || po.status === poFilterStatus;
                                    const matchesDate = !poFilterDate || po.poDate === format(poFilterDate, "dd-MM-yyyy");
                                    return matchesSearch && matchesWarehouse && matchesStatus && matchesDate;
                                }).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No Purchase Orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pos.filter(po => {
                                        const matchesSearch = po.poNumber.toLowerCase().includes(poSearchTerm.toLowerCase()) ||
                                            po.department.toLowerCase().includes(poSearchTerm.toLowerCase());
                                        const matchesWarehouse = poFilterWarehouse === "all" || po.warehouseName === poFilterWarehouse;
                                        const matchesStatus = poFilterStatus === "all" || po.status === poFilterStatus;
                                        const matchesDate = !poFilterDate || po.poDate === format(poFilterDate, "dd-MM-yyyy");
                                        return matchesSearch && matchesWarehouse && matchesStatus && matchesDate;
                                    }).map((po) => (
                                        <TableRow key={po.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4 font-medium font-mono">{po.poNumber}</TableCell>
                                            <TableCell>{formatDate(po.poDate)}</TableCell>
                                            <TableCell className="font-bold text-primary">{po.vendorName || "N/A"}</TableCell>
                                            <TableCell>{po.location}</TableCell>
                                            <TableCell>{po.warehouseName || "N/A"}</TableCell>
                                            <TableCell className="text-center">
                                                {getPOStatusBadge(po.status)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <TableActionButtons
                                                    onView={() => handleOpenPO(po, false)}
                                                    onEdit={(po.status === "Draft PO" || po.status === "Partially Completed PO") ? () => handleOpenPO(po, true) : undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {pos.filter(po => {
                        const matchesSearch = po.poNumber.toLowerCase().includes(poSearchTerm.toLowerCase()) ||
                            po.department.toLowerCase().includes(poSearchTerm.toLowerCase());
                        const matchesWarehouse = poFilterWarehouse === "all" || po.warehouseName === poFilterWarehouse;
                        const matchesStatus = poFilterStatus === "all" || po.status === poFilterStatus;
                        const matchesDate = !poFilterDate || po.poDate === format(poFilterDate, "dd-MM-yyyy");
                        return matchesSearch && matchesWarehouse && matchesStatus && matchesDate;
                    }).length > 0 && (
                        <DataTablePagination
                            currentPage={1}
                            totalPages={1}
                            totalItems={pos.filter(po => {
                                const matchesSearch = po.poNumber.toLowerCase().includes(poSearchTerm.toLowerCase()) ||
                                    po.department.toLowerCase().includes(poSearchTerm.toLowerCase());
                                const matchesWarehouse = poFilterWarehouse === "all" || po.warehouseName === poFilterWarehouse;
                                const matchesStatus = poFilterStatus === "all" || po.status === poFilterStatus;
                                const matchesDate = !poFilterDate || po.poDate === format(poFilterDate, "dd-MM-yyyy");
                                return matchesSearch && matchesWarehouse && matchesStatus && matchesDate;
                            }).length}
                            itemsPerPage={10}
                            onPageChange={() => {}}
                            onItemsPerPageChange={() => {}}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* PO VIEW/EDIT DIALOG */}
            <Dialog open={isPODialogOpen} onOpenChange={setIsPODialogOpen}>
                <DialogContent className="sm:max-w-[1000px] max-h-[95vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            {(activePO?.status === "Draft PO" || activePO?.status === "Partially Completed PO") && isPOEdit 
                                ? "Edit Purchase Order" 
                                : "View Purchase Order"}: {activePO?.poNumber}
                        </DialogTitle>
                        <DialogDescription>
                            {(activePO?.status === "Draft PO" || activePO?.status === "Partially Completed PO") && isPOEdit 
                                ? "Update PO details, pricing and delivery dates." 
                                : "Review PO details and item reception status."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* Printable Content */}
                        <div id="printable-po-content" className="hidden">
                            <div className="header" style={{ textAlign: "center", marginBottom: "30px", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>
                                <h1 style={{ margin: 0 }}>PURCHASE ORDER</h1>
                                <p style={{ color: "#666" }}>{activePO?.poNumber}</p>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "30px" }}>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Vendor Name</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500", border: "1px solid #eee", padding: "8px", borderRadius: "4px", backgroundColor: "#fcfcfc" }}>
                                        {activePO?.vendorName || "Not Selected"}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>PO Date</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.poDate ? formatDate(activePO.poDate) : "N/A"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Location</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.location}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Warehouse</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.warehouseName || "N/A"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Payment Terms</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.paymentTerms || "N/A"}</div>
                                </div>
                            </div>

                            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
                                <thead>
                                    <tr>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Item Code</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Item Name</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>UOM</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Quantity</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Price</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Delivery Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activePO?.items.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.itemCode}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.itemName}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.uom}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.requiredQty}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>USh {item.price || 0}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.deliveryDate ? formatDate(item.deliveryDate) : "N/A"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="footer" style={{ marginTop: "50px", textAlign: "right", fontSize: "10px", color: "#999" }}>
                                <p>Generated on {new Date().toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Visual UI */}
                        <div className="p-4 bg-muted/30 rounded-lg grid grid-cols-4 gap-4 border">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">PO Number</Label>
                                <p className="text-sm font-bold text-primary">{activePO?.poNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">PO Date</Label>
                                <p className="text-sm font-medium">{activePO?.poDate ? formatDate(activePO.poDate) : "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Location</Label>
                                <p className="text-sm font-medium">{activePO?.location}</p>
                            </div>
                            <div className="space-y-1 text-center">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block">PO Status</Label>
                                {activePO && getPOStatusBadge(activePO.status)}
                            </div>
                            <div className="space-y-1 col-span-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Vendor</Label>
                                <p className="text-sm font-bold text-primary">{activePO?.vendorName || "N/A"}</p>
                            </div>
                            <div className="space-y-1 flex flex-col">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Warehouse</Label>
                                <p className="text-sm font-medium">{activePO?.warehouseName || "N/A"}</p>
                            </div>
                            <div className="space-y-1 flex flex-col">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Payment Terms</Label>
                                {activePO?.status === "Draft PO" && isPOEdit ? (
                                    <Select
                                        value={activePO.paymentTerms || ""}
                                        onValueChange={(val) => setActivePO(prev => prev ? { ...prev, paymentTerms: val } : null)}
                                    >
                                        <SelectTrigger className="h-8 py-0">
                                            <SelectValue placeholder="Terms" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Net 30">Net 30</SelectItem>
                                            <SelectItem value="Net 15">Net 15</SelectItem>
                                            <SelectItem value="Advance">Advance</SelectItem>
                                            <SelectItem value="COD">COD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="text-sm font-medium">{activePO?.paymentTerms}</p>
                                )}
                            </div>
                        </div>

                        <Tabs defaultValue="po-items" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="po-items" className="font-bold">PO Items</TabsTrigger>
                                <TabsTrigger value="receive-items" className="font-bold">Receive Items</TabsTrigger>
                            </TabsList>

                            <TabsContent value="po-items" className="space-y-6 outline-none">
                                <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Items</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Qty Ordered</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase py-3 text-center">UOM</TableHead>
                                                {activePO?.status === "Draft PO" && isPOEdit ? (
                                                    <>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-28">Price/UOM</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6 w-40">Delivery Date</TableHead>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-28">Price/UOM</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-40">Delivery Date</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6">Qty Received</TableHead>
                                                    </>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activePO?.items.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                                                    <TableCell className="py-4 pl-6">
                                                        <div className="font-bold text-xs text-primary">{item.itemCode}</div>
                                                        <div className="text-xs text-slate-600 font-medium">{item.itemName}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-slate-700">{item.requiredQty}</TableCell>
                                                    <TableCell className="text-center text-xs font-medium text-slate-600 uppercase">{item.uom}</TableCell>

                                                    {activePO?.status === "Draft PO" && isPOEdit ? (
                                                        <>
                                                            <TableCell className="text-center min-w-[120px]">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span className="text-xs font-bold text-slate-500">USh</span>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 text-center font-bold px-1 flex-none"
                                                                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                                                                        value={item.price || ""}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value);
                                                                            if (val < 0) return;
                                                                            setActivePO(prev => {
                                                                                if (!prev) return null;
                                                                                return {
                                                                                    ...prev,
                                                                                    items: prev.items.map(i => i.id === item.id ? { ...i, price: val } : i)
                                                                                };
                                                                            });
                                                                        }}
                                                                    />
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">/{item.uom}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                <DatePicker
                                                                    date={item.deliveryDate ? parseDateString(item.deliveryDate) : undefined}
                                                                    setDate={(d) => {
                                                                        if (d && d < new Date()) {
                                                                            toast({ title: "Invalid Date", description: "Delivery date cannot be in the past.", variant: "destructive" });
                                                                            return;
                                                                        }
                                                                        setActivePO(prev => {
                                                                            if (!prev) return null;
                                                                            return {
                                                                                ...prev,
                                                                                items: prev.items.map(i => i.id === item.id ? { ...i, deliveryDate: d ? format(d, "dd-MM-yyyy") : undefined } : i)
                                                                            };
                                                                        });
                                                                    }}
                                                                />
                                                            </TableCell>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TableCell className="text-center font-bold text-xs text-slate-700">
                                                                USh {item.price || 0}/{item.uom}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-medium text-slate-600">
                                                                {item.deliveryDate ? formatDate(item.deliveryDate) : "N/A"}
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                <span className="font-bold text-primary">{item.qtyReceived || 0}</span>
                                                            </TableCell>
                                                        </>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="receive-items" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                                <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Reception Entries</span>
                                    </div>
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider pl-6">Item</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider text-right">Qty</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Date</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Document</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Note</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider text-right pr-6">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activePO?.receptions && activePO.receptions.length > 0 ? (
                                                activePO.receptions.map((r) => (
                                                    <TableRow key={r.id} className="hover:bg-slate-50/10 border-slate-50">
                                                        <TableCell className="pl-6">
                                                            <div className="font-medium text-slate-900">{r.itemCode}</div>
                                                            <div className="text-[10px] text-slate-400">{r.itemName}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-slate-900">{r.receivedQty}</TableCell>
                                                        <TableCell className="text-slate-600 text-xs">{r.deliveryDate ? formatDate(r.deliveryDate) : "N/A"}</TableCell>
                                                        <TableCell>
                                                            {r.attachmentName ? (
                                                                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-medium flex items-center gap-1 w-fit">
                                                                    <Paperclip className="h-3 w-3" />
                                                                    {r.attachmentName}
                                                                </Badge>
                                                            ) : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-slate-600 text-xs">{r.note || "-"}</TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            {r.attachmentName && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                                                    title="Download Document"
                                                                    onClick={() => handleDownloadQuotation(r.attachmentName!)}
                                                                >
                                                                    <Download className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                                                        No reception entries yet
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="space-y-2 mt-6">
                            <Label className="text-sm font-bold text-slate-700">Notes / Remarks</Label>
                            <Textarea
                                placeholder="Add any notes or remarks about this purchase order..."
                                className="min-h-[80px] bg-white border-slate-200 resize-none"
                                value={activePO?.notes || ""}
                                onChange={(e) => setActivePO(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                disabled={!(activePO?.status === "Draft PO" && isPOEdit)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t mt-auto flex sm:flex-row flex-col-reverse sm:justify-between justify-between items-center w-full sm:space-x-0">
                        <div className="flex justify-start">
                            {activePO?.status === "Draft PO" && isPOEdit && (
                                <Button 
                                    variant="destructive" 
                                    onClick={() => {
                                        setPoToDeleteRecord(activePO);
                                        setIsDeletePOAlertOpen(true);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsPODialogOpen(false)}>Close</Button>

                            {activePO?.status === "Draft PO" && isPOEdit && (
                                <>
                                    <Button
                                        variant="secondary"
                                        className="font-bold text-sm"
                                        onClick={() => {
                                            updatePos(pos.map(p => p.id === activePO.id ? activePO : p));
                                            setIsPODialogOpen(false);
                                            toast({ title: "PO Saved", description: "Draft changes have been saved." });
                                        }}
                                    >
                                        Save Draft
                                    </Button>
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                                        onClick={() => {
                                            const incomplete = activePO.items.some(i => !i.price || !i.deliveryDate);
                                            if (incomplete) {
                                                toast({ title: "Incomplete PO", description: "Please fill price and delivery date for all items.", variant: "destructive" });
                                                return;
                                            }
                                            const submittedPO = { ...activePO, status: "Submitted PO" as POStatus };
                                            updatePos(pos.map(p => p.id === activePO.id ? submittedPO : p));
                                            setIsPODialogOpen(false);
                                            toast({ title: "PO Submitted", description: "PO status updated to Submitted." });
                                        }}
                                    >
                                        Submit PO
                                    </Button>
                                </>
                            )}

                            {activePO?.status === "Partially Completed PO" && isPOEdit && (
                                <Button
                                    className="bg-primary hover:bg-primary/90 font-bold"
                                    onClick={() => {
                                        const completedPO = { ...activePO, status: "Completed PO" as POStatus };
                                        updatePos(pos.map(p => p.id === activePO.id ? completedPO : p));
                                        setIsPODialogOpen(false);
                                        toast({ title: "PO Completed", description: "Purchase Order has been marked as Completed." });
                                    }}
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    Complete PO
                                </Button>
                            )}

                            {activePO?.status === "Submitted PO" && !isPOEdit && (
                                <Button variant="secondary" onClick={handlePrintPO} className="font-bold">
                                    <Printer className="h-4 w-4 mr-2" />
                                    Print PO
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DeletePOAlert
                isOpen={isDeletePOAlertOpen}
                setOpen={setIsDeletePOAlertOpen}
                po={poToDeleteRecord}
                onDelete={handleDeletePO}
            />
        </div>
    );
};

const DeletePOAlert = ({ isOpen, setOpen, po, onDelete }: {
    isOpen: boolean,
    setOpen: (o: boolean) => void,
    po: POData | null,
    onDelete: (id: number) => void
}) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={setOpen}>
            <AlertDialogContent className="sm:max-w-[425px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this purchase order? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                            if (po) {
                                onDelete(po.id);
                            }
                        }}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default PO;
