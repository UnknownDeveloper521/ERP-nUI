import React, { useState, useEffect } from "react";
import { format, parseISO, parse, isValid } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Plus, Search, Eye, Check, ChevronsUpDown, Package, Trash2, Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { mockLocations, mockWorkCenters } from "@/lib/masterMockData";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

import {
    MRStatus,
    MRItem,
    MRRequestData,
    getStoredMRs,
    saveMRs
} from "@/lib/procurementSharedData";

interface MasterItem {
    id: number;
    code: string;
    name: string;
    type: "RM" | "Consumable";
    uom: string;
    availableQty: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_ITEMS: MasterItem[] = [
    { id: 101, code: "RM001", name: "Scrap Battery", type: "RM", uom: "Kg", availableQty: 500 },
    { id: 102, code: "RM002", name: "Plastic Pallets", type: "RM", uom: "Pcs", availableQty: 200 },
    { id: 103, code: "RM003", name: "Acid Type A", type: "RM", uom: "Ltr", availableQty: 150 },
    { id: 104, code: "RM004", name: "Acid Type B", type: "RM", uom: "Ltr", availableQty: 120 },
    { id: 105, code: "RM005", name: "Acid Type C", type: "RM", uom: "Ltr", availableQty: 100 },
    { id: 106, code: "CON001", name: "Safety Gloves", type: "Consumable", uom: "Pair", availableQty: 300 },
    { id: 107, code: "CON002", name: "Welding Wire", type: "Consumable", uom: "Kg", availableQty: 80 },
];

// INITIAL MOCK DATA IS NOW IN lib/procurementSharedData.ts

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

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
);

function DatePicker({ date, setDate, disabled = false, minDate, blockedDates }: {
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

        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayDate = new Date(year, month + 1, day);
            dayDate.setHours(0, 0, 0, 0);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isPast: minimumDate ? dayDate < minimumDate : false
            });
        }

        return days;
    };

    const renderDayView = () => {
        const days = getDaysInMonth(visibleDate);
        const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" className="font-semibold text-sm" onClick={() => setViewMode("month")}>
                            {monthNames[visibleDate.getMonth()]}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                        <Button variant="ghost" className="font-semibold text-sm" onClick={() => setViewMode("year")}>
                            {visibleDate.getFullYear()}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => (
                        <Button
                            key={index}
                            variant="ghost"
                            size="icon"
                            disabled={day.isPast}
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && !day.isPast && "hover:bg-accent hover:text-accent-foreground",
                                day.isPast && "opacity-30 cursor-not-allowed text-muted-foreground"
                            )}
                            onClick={() => !day.isPast && handleDateSelect(day.date)}
                        >
                            {day.date.getDate()}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMode("day")}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{visibleDate.getFullYear()}</h3>
                    <Button variant="ghost" className="font-semibold text-sm" onClick={() => setViewMode("year")}>
                        {visibleDate.getFullYear()}
                        <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {monthNamesShort.map((month, index) => (
                        <Button
                            key={month}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                index === visibleDate.getMonth() && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleMonthSelect(index)}
                        >
                            {month}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderYearView = () => {
        const currentYear = visibleDate.getFullYear();
        const startYear = Math.floor(currentYear / 12) * 12;
        const years = Array.from({ length: 12 }, (_, i) => startYear + i);

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        const newStartYear = startYear - 12;
                        setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                    }}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        const newStartYear = startYear + 12;
                        setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                    }}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => (
                        <Button
                            key={year}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                year === currentYear && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleYearSelect(year)}
                        >
                            {year}
                        </Button>
                    ))}
                </div>
            </div>
        );
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
                {viewMode === "day" && renderDayView()}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "year" && renderYearView()}
            </PopoverContent>
        </Popover>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MRRequest() {
    const { toast } = useToast();

    // Listing/Filtering state
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

    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>("Requested MR");
    // Pagination state - controls page number and rows per page
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<MRRequestData | null>(null);

    // Form states
    const [mrDate, setMrDate] = useState<Date>(new Date());
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [itemQuantity, setItemQuantity] = useState<string>("");
    const [addedItems, setAddedItems] = useState<MRItem[]>([]);
    const [isItemPopoverOpen, setIsItemPopoverOpen] = useState(false);

    // Update available quantity when item is selected
    useEffect(() => {
        if (selectedItemId) {
            const item = MOCK_ITEMS.find(i => i.id.toString() === selectedItemId);
            if (item) {
                setItemQuantity(item.availableQty.toString());
            }
        } else {
            setItemQuantity("");
        }
    }, [selectedItemId]);

    // Auto-selected fields (simulated)
    const [headerInfo, setHeaderInfo] = useState({
        location: "Jinja",
        workCenter: "Lead Furnace Center",
        department: "Production",
        requestedBy: "Admin User"
    });

    // Handlers
    const handleAddItem = () => {
        if (!selectedItemId) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please select an item." });
            return;
        }

        const masterItem = MOCK_ITEMS.find(i => i.id.toString() === selectedItemId);
        if (!masterItem) return;

        const newItem: MRItem = {
            id: Date.now(),
            itemCode: masterItem.code,
            itemName: masterItem.name,
            uom: masterItem.uom,
            type: masterItem.type,
            requiredQty: 1, // Default quantity to 1 when added
            availableQty: masterItem.availableQty,
            quotations: [],
            qtyReceived: 0
        };

        setAddedItems(prev => [...prev, newItem]);
        setSelectedItemId("");
        setItemQuantity("");
        toast({ title: "Item Added", description: `${masterItem.name} added to the request.` });
    };

    const handleRemoveItem = (id: number | string) => {
        setAddedItems(addedItems.filter(i => i.id !== id));
    };

    const handleUpdateItemQuantity = (id: number | string, newQty: string) => {
        const qty = parseFloat(newQty);
        setAddedItems(prev => prev.map(item =>
            item.id === id ? { ...item, requiredQty: isNaN(qty) ? 0 : qty } : item
        ));
    };

    const handleSaveMR = () => {
        if (addedItems.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Add at least one item." });
            return;
        }

        const newRequest: MRRequestData = {
            id: Date.now(),
            mrCode: `MR-${new Date().getFullYear()}-${String(requests.length + 1).padStart(3, '0')}`,
            mrDate: format(mrDate, "dd-MM-yyyy"),
            location: headerInfo.location,
            workCenter: headerInfo.workCenter,
            department: headerInfo.department,
            status: "Requested MR",
            requestedBy: headerInfo.requestedBy,
            items: addedItems
        };

        updateRequests([newRequest, ...requests]);
        setIsFormModalOpen(false);
        setAddedItems([]);
        setMrDate(new Date());
        toast({ title: "Success", description: "MR Request created successfully." });
    };

    const handleOpenCreateModal = () => {
        setAddedItems([]);
        setMrDate(new Date());
        setSelectedItemId("");
        setItemQuantity("");
        setIsFormModalOpen(true);
    };

    const getStatusBadge = (status: MRStatus) => {
        switch (status) {
            case "Requested MR": return <Badge className="bg-blue-500 hover:bg-blue-600">Requested MR</Badge>;
            case "MR in Fullfillment": return <Badge className="bg-orange-500 hover:bg-orange-600">MR in Fullfillment</Badge>;
            case "FullFilled MR": return <Badge className="bg-green-500 hover:bg-green-600">FullFilled MR</Badge>;
            case "MR Closed": return <Badge variant="secondary">MR Closed</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Filtering Logic
    const filtered = requests.filter(r => {
        const matchesSearch = r.mrCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.workCenter.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.location.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = filterDate ? r.mrDate === format(filterDate, "dd-MM-yyyy") : true;
        const matchesStatus = filterStatus === "all" ? true : r.status === filterStatus;

        return matchesSearch && matchesDate && matchesStatus;
    });

    // Pagination calculations - slice data for current page
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Auto-adjust page when data changes (e.g., after filtering or deleting)
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filtered.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterDate, filterStatus]);

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">My MR</h1>
            </div>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Code, Location or WorkCenter..."
                            className="pl-9 h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="w-full sm:w-56">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter By Date</Label>
                    <div className="flex gap-2">
                        <DatePicker date={filterDate} setDate={setFilterDate} />
                        {filterDate && (
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setFilterDate(undefined)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                </div>
                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter By Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
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
                <Button onClick={handleOpenCreateModal} className="h-10">
                    <Plus className="mr-2 h-4 w-4" />
                    Create MR
                </Button>
            </div>

            {/* Listing Table */}
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
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginated.length > 0 ? paginated.map((req) => (
                                    <TableRow key={req.id} className="hover:bg-muted/30 transition-colors border-b">
                                        <TableCell className="py-4 font-medium font-mono">{req.mrCode}</TableCell>
                                        <TableCell>{formatDate(req.mrDate)}</TableCell>
                                        <TableCell>{req.location}</TableCell>
                                        <TableCell>{req.workCenter}</TableCell>
                                        <TableCell className="text-center">{getStatusBadge(req.status)}</TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => { setViewingRequest(req); setIsViewModalOpen(true); }}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No MR requests found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filtered.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filtered.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* CREATE MR DIALOG */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 bg-white">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-bold">Add New MR Request</DialogTitle>
                        <DialogDescription>
                            Configure the details and items for this material request.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        <div>
                            <SectionHeader title="General Information" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>MR Date *</Label>
                                    <Input value={format(mrDate, "dd-MM-yyyy")} readOnly className="h-10 bg-muted/30" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Location *</Label>
                                    <Select
                                        value={headerInfo.location}
                                        onValueChange={(val) => setHeaderInfo(prev => ({ ...prev, location: val }))}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Select Location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {mockLocations.map(loc => (
                                                <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Workcenter</Label>
                                    <Select
                                        value={headerInfo.workCenter}
                                        onValueChange={(val) => setHeaderInfo(prev => ({ ...prev, workCenter: val }))}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Select Workcenter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {mockWorkCenters.map(wc => (
                                                <SelectItem key={wc.id} value={wc.name}>{wc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Department *</Label>
                                    <Select
                                        value={headerInfo.department}
                                        onValueChange={(val) => setHeaderInfo(prev => ({ ...prev, department: val }))}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Production">Production</SelectItem>
                                            <SelectItem value="Engineering">Engineering</SelectItem>
                                            <SelectItem value="Human Resources">Human Resources</SelectItem>
                                            <SelectItem value="Finance">Finance</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <SectionHeader title="Material Requirements" />
                            <div className="flex gap-2 items-end mb-4">
                                <div className="flex-1 space-y-2">
                                    <Label>Select Item (RM / Consumables)</Label>
                                    <Popover open={isItemPopoverOpen} onOpenChange={setIsItemPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-full h-10 justify-between font-normal">
                                                {selectedItemId ? MOCK_ITEMS.find(i => i.id.toString() === selectedItemId)?.name : "Choose Item..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                            <Command>
                                                <CommandInputBorderless placeholder="Search item..." />
                                                <CommandList className="max-h-[130px] overflow-y-auto">
                                                    <CommandEmpty>No item found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {MOCK_ITEMS.map((item) => {
                                                            const isAdded = addedItems.some(ai => ai.itemCode === item.code);
                                                            return (
                                                                <CommandItem
                                                                    key={item.id}
                                                                    value={item.name}
                                                                    disabled={isAdded}
                                                                    onSelect={() => {
                                                                        if (!isAdded) {
                                                                            setSelectedItemId(item.id.toString());
                                                                            setIsItemPopoverOpen(false);
                                                                        }
                                                                    }}
                                                                    className={cn(isAdded && "opacity-50 cursor-not-allowed")}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedItemId === item.id.toString() ? "opacity-100" : "opacity-0")} />
                                                                    <span className={cn(isAdded && "text-muted-foreground")}>
                                                                        {item.code} - {item.name} {isAdded && "(Added)"}
                                                                    </span>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Button
                                    onClick={handleAddItem}
                                    className="h-10"
                                    disabled={!selectedItemId}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                </Button>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Item Details</TableHead>
                                            <TableHead className="text-center">UOM</TableHead>
                                            <TableHead className="text-center">Type</TableHead>
                                            <TableHead className="text-center">Stock</TableHead>
                                            <TableHead className="w-[120px] text-right">Qty Needed</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {addedItems.length > 0 ? addedItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{item.itemName}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">{item.itemCode}</div>
                                                </TableCell>
                                                <TableCell className="text-center text-xs">{item.uom}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-medium">{item.availableQty}</TableCell>
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        className={cn("h-8 w-20 ml-auto text-right", item.requiredQty <= 0 && "border-destructive")}
                                                        value={item.requiredQty || ""}
                                                        onChange={(e) => handleUpdateItemQuantity(item.id, e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveItem(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground h-20 text-sm italic">No items added.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto">
                        <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveMR} disabled={addedItems.length === 0 || addedItems.some(item => item.requiredQty <= 0)}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* VIEW MR DIALOG */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 bg-white">
                    {viewingRequest && (
                        <>
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle className="text-xl font-bold">MR Details</DialogTitle>
                                <DialogDescription>
                                    View material request details
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                                {/* Header Info Grid */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">MR Code</Label>
                                        <p className="font-medium">{viewingRequest.mrCode}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">MR Date</Label>
                                        <p className="font-medium">{formatDate(viewingRequest.mrDate)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Status</Label>
                                        <div className="pt-0.5">{getStatusBadge(viewingRequest.status)}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Requested By</Label>
                                        <p className="font-medium">{viewingRequest.requestedBy}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Location</Label>
                                        <p className="font-medium">{viewingRequest.location}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Workcenter</Label>
                                        <p className="font-medium">{viewingRequest.workCenter}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Department</Label>
                                        <p className="font-medium">{viewingRequest.department}</p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <Label className="text-sm font-semibold mb-3 block">Requested Items</Label>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="py-2.5">Item</TableHead>
                                                    <TableHead className="py-2.5 text-center">Type</TableHead>
                                                    <TableHead className="py-2.5 text-right pr-6">Quantity</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {viewingRequest.items.map((item) => (
                                                    <TableRow key={item.id} className="border-b last:border-none">
                                                        <TableCell className="py-3">
                                                            <div>
                                                                <div className="font-medium text-sm">{item.itemCode}</div>
                                                                <div className="text-xs text-muted-foreground mt-0.5">{item.itemName}</div>
                                                                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{item.uom}</div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-primary pr-6">
                                                            {item.requiredQty}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-6 border-t mt-auto">
                                <Button variant="outline" onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto">Close</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
