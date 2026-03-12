import React, { useState, useEffect, useRef } from "react";
import { format, parse, isValid } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    Eye,
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
    Edit,
    Printer,
    Download
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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

const formatDate = (date: Date | string): string => {
    if (!date) return "";
    const d = typeof date === 'string' ? parseDateString(date) : date;
    if (!isValid(d)) return typeof date === 'string' ? date : "";
    return format(d, "dd-MM-yyyy");
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
                isDisabled: currentDate < today
            });
        }

        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const currentDate = new Date(year, month + 1, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            days.push({
                date: currentDate,
                isCurrentMonth: false,
                isDisabled: currentDate < today
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

const getStatusBadge = (status: MRStatus) => {
    switch (status) {
        case "Requested MR": return <Badge className="bg-blue-500 hover:bg-blue-600">Requested MR</Badge>;
        case "MR in Fullfillment": return <Badge className="bg-orange-500 hover:bg-orange-600">MR in Fullfillment</Badge>;
        case "FullFilled MR": return <Badge className="bg-green-500 hover:bg-green-600">FullFilled MR</Badge>;
        case "MR Closed": return <Badge variant="secondary">MR Closed</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

const MRExecution = () => {
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

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>("Requested MR");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // PO State
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

    // Dialog states
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [activeRequest, setActiveRequest] = useState<MRRequestData | null>(null);

    // Selection state for PO
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

    const [activeItemId, setActiveItemId] = useState<number | null>(null);
    const [vendorName, setVendorName] = useState("");
    const [attachmentName, setAttachmentName] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Configuration Tab States
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
    const [selectedVendorForPO, setSelectedVendorForPO] = useState<string>("");
    const [quoteVendor, setQuoteVendor] = useState<string>("");
    const [quoteNote, setQuoteNote] = useState<string>("");

    const filteredMRs = requests.filter(mr => {
        const matchesSearch = mr.mrCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mr.workCenter.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mr.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mr.department.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = filterDate ? mr.mrDate === format(filterDate, "dd-MM-yyyy") : true;
        const matchesStatus = filterStatus === "all" ? true : mr.status === filterStatus;

        return matchesSearch && matchesDate && matchesStatus;
    });

    const totalPages = Math.ceil(filteredMRs.length / itemsPerPage);
    const paginatedData = filteredMRs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredMRs.length, currentPage, totalPages]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterDate, filterStatus]);

    const handleOpenConfig = (req: MRRequestData) => {
        setActiveRequest(JSON.parse(JSON.stringify(req)));
        setSelectedItemIds([]);
        setSelectedWarehouse("");
        setSelectedVendorForPO("");
        setQuoteVendor("");
        setQuoteNote("");
        setAttachmentName("");
        setIsConfigModalOpen(true);
    };

    const handleCreatePO = () => {
        if (!activeRequest || selectedItemIds.length === 0 || !selectedVendorForPO || !selectedWarehouse) {
            toast({
                title: "Validation Error",
                description: "Please select items, a vendor, and a warehouse to create a PO.",
                variant: "destructive"
            });
            return;
        }

        const updatedRequest = { ...activeRequest };
        const poNum = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const selectedItems = activeRequest.items.filter(item => selectedItemIds.includes(item.id));

        updatedRequest.items.forEach(item => {
            if (selectedItemIds.includes(item.id)) {
                item.poNumber = poNum;
            }
        });

        const allDone = updatedRequest.items.every(i => !!i.poNumber);
        if (allDone) {
            updatedRequest.status = "MR in Fullfillment";
        }

        const newPO: POData = {
            id: Date.now(),
            poNumber: poNum,
            poDate: format(new Date(), "dd-MM-yyyy"),
            mrCode: updatedRequest.mrCode,
            location: updatedRequest.location,
            department: updatedRequest.department,
            workCenter: updatedRequest.workCenter,
            createdBy: "Admin User",
            vendorName: selectedVendorForPO,
            warehouseName: selectedWarehouse,
            paymentTerms: "Net 30",
            items: JSON.parse(JSON.stringify(selectedItems)),
            status: "Draft PO",
            receptions: []
        };

        updatePos([...pos, newPO]);
        setActiveRequest(updatedRequest);
        updateRequests(requests.map(r => r.id === updatedRequest.id ? updatedRequest : r));
        setSelectedItemIds([]);
        setSelectedVendorForPO("");
        setSelectedWarehouse("");
        toast({ title: "PO Created", description: `Purchase Order ${poNum} successfully generated.` });
    };

    const handleAddQuotationRow = () => {
        if (!quoteVendor || !activeRequest) return;

        const newQuote: Quotation = {
            id: Date.now(),
            vendorName: quoteVendor,
            note: quoteNote,
            attachmentName: attachmentName || undefined
        };

        const updatedRequest = { ...activeRequest };
        if (!updatedRequest.quotations) updatedRequest.quotations = [];
        updatedRequest.quotations.push(newQuote);

        setActiveRequest(updatedRequest);
        updateRequests(requests.map(r => r.id === updatedRequest.id ? updatedRequest : r));

        setQuoteVendor("");
        setQuoteNote("");
        setAttachmentName("");
        if (fileInputRef.current) fileInputRef.current.value = "";

        toast({ title: "Quotation Added", description: "The quotation has been added to the list." });
    };

    const handleDeleteQuotationRow = (quoteId: number) => {
        if (!activeRequest) return;
        const updatedRequest = { ...activeRequest };
        if (updatedRequest.quotations) {
            updatedRequest.quotations = updatedRequest.quotations.filter(q => q.id !== quoteId);
        }
        setActiveRequest(updatedRequest);
        updateRequests(requests.map(r => r.id === updatedRequest.id ? updatedRequest : r));
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
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">MR Execution</h1>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Code, Location, WorkCenter or Dept..."
                            className="pl-9 h-10"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>
                <div className="w-full sm:w-56">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter By Date</Label>
                    <div className="flex gap-2">
                        <DatePicker date={filterDate} setDate={(date) => {
                            setFilterDate(date);
                            setCurrentPage(1);
                        }} />
                        {filterDate && (
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => {
                                setFilterDate(undefined);
                                setCurrentPage(1);
                            }}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                </div>
                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter By Status</Label>
                    <Select value={filterStatus} onValueChange={(val) => {
                        setFilterStatus(val);
                        setCurrentPage(1);
                    }}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Requested MR">Requested MR</SelectItem>
                            <SelectItem value="MR in Fullfillment">MR in Fullfillment</SelectItem>
                            <SelectItem value="FullFilled MR">FullFilled MR</SelectItem>
                            <SelectItem value="MR Closed">MR Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Workcenter</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Department</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Requested By</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No MR Requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((request) => (
                                        <TableRow key={request.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4 font-medium font-mono">{request.mrCode}</TableCell>
                                            <TableCell>{formatDate(request.mrDate)}</TableCell>
                                            <TableCell>{request.location}</TableCell>
                                            <TableCell>{request.workCenter}</TableCell>
                                            <TableCell>{request.department}</TableCell>
                                            <TableCell>{request.requestedBy}</TableCell>
                                            <TableCell className="text-center">{getStatusBadge(request.status)}</TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={() => handleOpenConfig(request)}
                                                >
                                                    <Settings2 className="h-4 w-4 mr-1" />
                                                    Configure
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredMRs.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredMRs.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* CONFIGURE MR DIALOG */}
            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogContent className="sm:max-w-[1000px] max-h-[95vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-primary" />
                            Configure Material Request: {activeRequest?.mrCode}
                        </DialogTitle>
                        <DialogDescription>
                            Review MR details, manage quotations, and create purchase orders.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        <div className="p-4 bg-muted/30 rounded-lg grid grid-cols-4 gap-4 border">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">MR Date</Label>
                                <p className="text-sm font-medium">{activeRequest?.mrDate ? formatDate(activeRequest.mrDate) : "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Location</Label>
                                <p className="text-sm font-medium">{activeRequest?.location}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Workcenter</Label>
                                <p className="text-sm font-medium">{activeRequest?.workCenter}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Department</Label>
                                <p className="text-sm font-medium">{activeRequest?.department}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Requested By</Label>
                                <p className="text-sm font-medium">{activeRequest?.requestedBy}</p>
                            </div>
                            <div className="space-y-1 col-span-3">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                <div className="pt-0.5">{activeRequest && getStatusBadge(activeRequest.status)}</div>
                            </div>
                        </div>

                        <Tabs defaultValue="items" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="items" className="font-bold">Material Items</TabsTrigger>
                                <TabsTrigger value="quotes" className="font-bold">Quotations</TabsTrigger>
                            </TabsList>

                            <TabsContent value="items" className="space-y-6 outline-none">
                                <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                    <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="w-12 text-center py-3">
                                                        <Checkbox
                                                            checked={selectedItemIds.length === activeRequest?.items.filter(i => !i.poNumber).length && (activeRequest?.items.filter(i => !i.poNumber).length || 0) > 0}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedItemIds(activeRequest?.items.filter(i => !i.poNumber).map(i => i.id) || []);
                                                                } else {
                                                                    setSelectedItemIds([]);
                                                                }
                                                            }}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3">Items</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Requested Qty</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Stock</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6">Po No.</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activeRequest?.items.map((item) => (
                                                    <TableRow key={item.id} className={cn("hover:bg-muted/20 transition-colors", item.poNumber && "opacity-60")}>
                                                        <TableCell className="text-center">
                                                            <Checkbox
                                                                disabled={!!item.poNumber}
                                                                checked={selectedItemIds.includes(item.id)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setSelectedItemIds(prev => [...prev, item.id]);
                                                                    else setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="font-bold text-xs text-primary">{item.itemCode}</div>
                                                            <div className="text-xs text-slate-600 font-medium">{item.itemName}</div>
                                                            <div className="text-[9px] text-muted-foreground uppercase">{item.uom}</div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-primary">{item.requiredQty}</TableCell>
                                                        <TableCell className="text-center font-medium text-slate-600">{item.availableQty}</TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            {item.poNumber ? (
                                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-mono">
                                                                    {item.poNumber}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">Pending</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {activeRequest?.items.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                            No items found in this request.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 items-end p-4 bg-muted/20 rounded-lg border border-dashed border-primary/20">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Select Warehouse</Label>
                                        <Select
                                            disabled={selectedItemIds.length === 0}
                                            value={selectedWarehouse}
                                            onValueChange={setSelectedWarehouse}
                                        >
                                            <SelectTrigger className="h-10 bg-white">
                                                <SelectValue placeholder="Choose Warehouse..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {mockWarehouses.map(wh => (
                                                    <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Select Vendor</Label>
                                        <Select
                                            disabled={selectedItemIds.length === 0}
                                            value={selectedVendorForPO}
                                            onValueChange={setSelectedVendorForPO}
                                        >
                                            <SelectTrigger className="h-10 bg-white">
                                                <SelectValue placeholder="Choose Vendor..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {mockTransporters.map(v => (
                                                    <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        disabled={selectedItemIds.length === 0 || !selectedWarehouse || !selectedVendorForPO}
                                        onClick={handleCreatePO}
                                        className="h-10 font-bold transition-all active:scale-95 shadow-md shadow-primary/20"
                                    >
                                        <Plus className="h-4 w-4 mr-1.5" />
                                        Create PO
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="quotes" className="space-y-6 outline-none">
                                {!(activeRequest?.status === "FullFilled MR" || activeRequest?.status === "MR Closed") && (
                                    <div className="bg-muted/30 p-4 rounded-xl border shadow-sm space-y-4">
                                        <div className="flex items-end gap-3">
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Vendor Selection</Label>
                                                <Select value={quoteVendor} onValueChange={setQuoteVendor}>
                                                    <SelectTrigger className="h-10 bg-white border-slate-200">
                                                        <SelectValue placeholder="Select Vendor..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {mockTransporters.map(v => (
                                                            <SelectItem
                                                                key={v.id}
                                                                value={v.name}
                                                                disabled={activeRequest?.quotations?.some(q => q.vendorName === v.name)}
                                                            >
                                                                {v.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex-[1.5] space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Notes</Label>
                                                <Input
                                                    placeholder="Add terms or notes..."
                                                    value={quoteNote}
                                                    onChange={(e) => setQuoteNote(e.target.value)}
                                                    className="h-10 bg-white border-slate-200 shadow-none focus:ring-0 focus:border-primary transition-all text-sm"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground opacity-0">File</Label>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    ref={fileInputRef}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setAttachmentName(file.name);
                                                    }}
                                                />
                                                <Button
                                                    variant={attachmentName ? "default" : "outline"}
                                                    size="icon"
                                                    className={cn(
                                                        "h-10 w-10 shrink-0 bg-white border-slate-200",
                                                        attachmentName && "bg-emerald-500 hover:bg-emerald-600 border-none text-white shadow-lg shadow-emerald-100"
                                                    )}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    title={attachmentName ? "Change attachment" : "Attach file"}
                                                >
                                                    <Paperclip className="h-5 w-5" />
                                                </Button>
                                            </div>
                                            <Button
                                                className="h-10 px-6 font-bold shadow-md"
                                                disabled={!quoteVendor}
                                                onClick={handleAddQuotationRow}
                                            >
                                                Add
                                            </Button>
                                        </div>

                                        {attachmentName && (
                                            <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-md animate-in slide-in-from-top-1">
                                                <FileText className="h-4 w-4 text-emerald-600" />
                                                <span className="text-xs font-medium text-emerald-700 truncate max-w-[300px]">{attachmentName}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 ml-auto text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                                    onClick={() => {
                                                        setAttachmentName("");
                                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                    <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Vendor</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3">Note</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Document</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activeRequest?.quotations?.map((q) => (
                                                    <TableRow key={q.id} className="group hover:bg-muted/20 transition-colors border-b">
                                                        <TableCell className="py-4 pl-6">
                                                            <span className="font-bold text-xs uppercase text-primary">{q.vendorName}</span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <span className="text-xs text-slate-600 italic">{q.note || "No notes"}</span>
                                                        </TableCell>
                                                        <TableCell className="text-center py-4">
                                                            {q.attachmentName ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 gap-2"
                                                                    onClick={() => handleDownloadQuotation(q.attachmentName!)}
                                                                >
                                                                    <FileText className="h-4 w-4" />
                                                                    <span className="text-xs font-medium">{q.attachmentName}</span>
                                                                </Button>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground opacity-50">No doc</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            {!(activeRequest?.status === "FullFilled MR" || activeRequest?.status === "MR Closed") && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                                    onClick={() => handleDeleteQuotationRow(q.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-6 border-t mt-auto gap-2">
                        <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>Close</Button>
                        {!(activeRequest?.status === "FullFilled MR" || activeRequest?.status === "MR Closed") && (
                            <Button
                                className="font-bold px-8"
                                onClick={() => {
                                    setIsConfigModalOpen(false);
                                    toast({ title: "Changes Saved", description: "MR configuration has been updated successfully." });
                                }}
                            >
                                Save
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MRExecution;
