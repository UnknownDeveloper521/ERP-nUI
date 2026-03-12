// ============================================================================
// INVENTORY SMR REQUESTS MODULE
// Service Material Request listing and management for Inventory
// Connected to Service Center SMR module via shared data store
// ============================================================================

import React, { useState } from "react";
import { format, parse } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    Eye,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Calendar as CalendarIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
// Import shared SMR data and types
import {
    type SMRStatus,
    type SMRItem,
    type SMRRequest,
    mockSMRRequests,
    updateSMRRequest
} from "@/lib/smrSharedData";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get status badge with appropriate styling based on SMR status
 * @param status - The SMR status
 * @returns Badge component with appropriate styling
 */
const getStatusBadge = (status: SMRStatus) => {
    switch (status) {
        case "Requested Req.":
            return <Badge className="bg-blue-500 hover:bg-blue-600">Requested Req.</Badge>;
        case "Issued Req. by WH":
            return <Badge className="bg-orange-500 hover:bg-orange-600">Issued Req. by WH</Badge>;
        case "Received Req. by SC":
            return <Badge className="bg-green-500 hover:bg-green-600">Received Req. by SC</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

/**
 * Custom date picker component
 */
function DatePicker({ date, setDate, disabled = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean
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
        setDate(selectedDate);
        setIsOpen(false);
        setViewMode("day");
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

        // Previous month days
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonth.getDate() - i);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected
            });
        }

        // Next month days
        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayDate = new Date(year, month + 1, day);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false
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
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("month")}
                        >
                            {monthNames[visibleDate.getMonth()]}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("year")}
                        >
                            {visibleDate.getFullYear()}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(1)}
                    >
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
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
                            )}
                            onClick={() => handleDateSelect(day.date)}
                        >
                            {day.date.getDate()}
                        </Button>
                    ))}
                </div>
            </div>
        );
    }

    const renderMonthView = () => {
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewMode("day")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{visibleDate.getFullYear()}</h3>
                    <Button
                        variant="ghost"
                        className="font-semibold text-sm"
                        onClick={() => setViewMode("year")}
                    >
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
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear - 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear + 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
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

/**
 * Inventory SMR Requests Component
 * Displays and manages Service Material Requests in the Inventory module
 */
export default function InventorySMRRequests() {
    const { toast } = useToast();

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    // State for listing - sync with shared data on mount
    const [smrRequests, setSmrRequests] = useState<SMRRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    // Default filter status: "Requested Req." - shows only requests that need to be issued
    const [filterStatus, setFilterStatus] = useState<SMRStatus | "all">("Requested Req.");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // QR Scanning state: Map of ItemID -> Array of SerialNumbers
    const [scannedSerialsPerItem, setScannedSerialsPerItem] = useState<Record<string | number, string[]>>({});
    const [activeScanItem, setActiveScanItem] = useState<string | number | "">("");
    const [scanInputValue, setScanInputValue] = useState("");

    // Modal states
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<SMRRequest | null>(null);

    // Sync with shared data on component mount
    React.useEffect(() => {
        setSmrRequests([...mockSMRRequests]);
    }, []);

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handler for viewing SMR request details
     * Opens the detail popup with issue/view functionality based on status
     * @param request - The SMR request to view
     */
    const handleView = (request: SMRRequest) => {
        // For "Requested Req." status, autofill issueQty with requestedQty or qtyNeeded
        if (request.status === "Requested Req.") {
            setViewingRequest({
                ...request,
                items: request.items.map(item => ({
                    ...item,
                    issueQty: item.requestedQty || item.qtyNeeded || 0
                }))
            });
            // Clear scanned serials when opening a new request
            setScannedSerialsPerItem({});
        } else {
            setViewingRequest(request);
        }
        setIsViewModalOpen(true);
    };

    /**
     * Handler for changing issue quantity for an item
     * Validates that issue qty doesn't exceed available or requested qty
     * @param itemId - The item ID
     * @param value - The new issue quantity value
     */
    const handleIssueQtyChange = (itemId: number | string, value: string) => {
        if (!viewingRequest) return;

        // Remove non-numeric characters except decimal point
        const numericValue = value.replace(/[^0-9.]/g, '');

        // Check if value exceeds 5 digits (before decimal point)
        const integerPart = numericValue.split('.')[0];
        if (integerPart.length > 5) {
            return; // Prevent update if exceeds max length
        }

        const qty = parseFloat(numericValue) || 0;
        setViewingRequest({
            ...viewingRequest,
            items: viewingRequest.items.map(item =>
                item.id === itemId ? { ...item, issueQty: qty } : item
            )
        });
    };

    /**
     * Handler for issuing items
     * Validates issue quantities and updates status to "Issued SMR by WH"
     */
    const handleIssueItems = () => {
        if (!viewingRequest) return;

        // Validation: Ensure scanned serials match issue quantity for FG items
        const scanErrors: string[] = [];
        viewingRequest.items.forEach(item => {
            const issueQty = item.issueQty || 0;
            const serialsCount = scannedSerialsPerItem[item.id]?.length || 0;

            // If scanning is done, it should match the issue quantity
            // For now, let's just warn if serials are missing but allow optional
            // But if serials are present, they shouldn't exceed issue qty
            if (serialsCount > issueQty) {
                scanErrors.push(`${item.itemName}: Scanned serials (${serialsCount}) exceed issue quantity (${issueQty})`);
            }
        });

        if (scanErrors.length > 0) {
            toast({
                title: "Scanning Error",
                description: scanErrors.join(", "),
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if at least one item has issue qty > 0
        const hasItemsToIssue = viewingRequest.items.some(item => (item.issueQty || 0) > 0);
        if (!hasItemsToIssue) {
            toast({
                title: "Validation Error",
                description: "At least one item must be issued.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if any issue qty exceeds available or requested qty
        const invalidItems = viewingRequest.items.filter(item => {
            const issueQty = item.issueQty || 0;
            const availableQty = item.availableStock || 0;
            const requestedQty = item.requestedQty || item.qtyNeeded || 0;
            return issueQty > availableQty || issueQty > requestedQty;
        });

        if (invalidItems.length > 0) {
            toast({
                title: "Validation Error",
                description: "Issue quantity cannot exceed available or requested quantity.",
                variant: "destructive"
            });
            return;
        }

        // Update the request using shared update function
        const updatedItems = viewingRequest.items.map(item => ({
            ...item,
            issueQty: item.issueQty || 0,
            requestedQty: item.requestedQty || item.qtyNeeded,
            serialNumbers: scannedSerialsPerItem[item.id] || []
        }));

        const updatedData = updateSMRRequest(viewingRequest.id, {
            status: "Issued Req. by WH",
            issuedDate: format(new Date(), "yyyy-MM-dd"),
            issuedBy: "Warehouse Manager", // In real app, get from auth context
            items: updatedItems
        });

        setSmrRequests(updatedData);

        toast({
            title: "Success",
            description: `Items for ${viewingRequest.smrNo} have been issued successfully.`,
        });

        setIsViewModalOpen(false);
        setViewingRequest(null);
    };

    // ========================================================================
    // FILTERING AND PAGINATION
    // ========================================================================

    /**
     * Filter SMR requests based on search term and status filter
     */
    const filteredRequests = smrRequests.filter(request => {
        const matchesSearch =
            request.smrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.workCenter.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === "all" ? true : request.status === filterStatus;

        let matchesDate = true;
        if (dateFilter) {
            const requestDateObj = parse(request.smrRequestDate, 'dd-MM-yyyy', new Date());
            requestDateObj.setHours(0, 0, 0, 0);
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            matchesDate = requestDateObj.getTime() === filterDate.getTime();
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const paginatedData = filteredRequests.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredRequests.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, dateFilter]);

    // ========================================================================
    // RENDER: DETAIL POPUP
    // ========================================================================

    /**
     * Renders the detail popup based on SMR status
     * - Requested SMR: Shows issue form with editable issue quantities
     * - Issued SMR by WH: Shows read-only issued quantities
     * - Received SMR by SC: Shows read-only issued quantities
     */
    const renderDetailPopup = () => {
        if (!viewingRequest) return null;

        const isRequestedStatus = viewingRequest.status === "Requested Req.";
        const isIssuedStatus = viewingRequest.status === "Issued Req. by WH";

        const handleScanKeyDown = (itemId: string | number, e: React.KeyboardEvent) => {
            if (e.key === "Enter" && scanInputValue.trim()) {
                e.preventDefault();
                const serial = scanInputValue.trim();
                const currentSerials = scannedSerialsPerItem[itemId] || [];

                if (currentSerials.includes(serial)) {
                    toast({ title: "Duplicate Serial", description: "This serial number has already been scanned.", variant: "destructive" });
                } else {
                    setScannedSerialsPerItem(prev => ({
                        ...prev,
                        [itemId]: [...currentSerials, serial]
                    }));
                    setScanInputValue("");
                }
            }
        };

        return (
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-bold">
                                    Material Requisition: {viewingRequest.smrNo}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    {isRequestedStatus ? "Issue materials for this requisition" : "View material requisition details"}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* SMR INFORMATION - Horizontal Layout */}
                    <div className="px-6 py-4 bg-slate-50/50 border-b">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">SMR No</Label>
                                <p className="text-sm font-semibold">{viewingRequest.smrNo}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Request Date</Label>
                                <p className="text-sm font-semibold">{format(new Date(viewingRequest.smrRequestDate), "dd/MM/yyyy")}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Work Center</Label>
                                <p className="text-sm font-semibold truncate" title={viewingRequest.workCenter}>{viewingRequest.workCenter}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Department</Label>
                                <p className="text-sm font-semibold truncate" title={viewingRequest.department}>{viewingRequest.department}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Requested By</Label>
                                <p className="text-sm font-semibold">{viewingRequest.requestedBy}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Status</Label>
                                <div className="block">{getStatusBadge(viewingRequest.status)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* Global Scanning Section - only for Requested Req. status */}
                        {isRequestedStatus && (
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 shadow-sm transition-all animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-12 md:col-span-4">
                                        <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Select Item to Scan</Label>
                                        <Select
                                            value={activeScanItem.toString()}
                                            onValueChange={(v) => {
                                                setActiveScanItem(v);
                                                setScanInputValue("");
                                            }}
                                        >
                                            <SelectTrigger className="h-11 bg-white border-blue-200 focus:ring-blue-500 shadow-sm">
                                                <SelectValue placeholder="Choose an item..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {viewingRequest.items.map(item => (
                                                    <SelectItem key={item.id} value={item.id.toString()}>
                                                        {item.itemName} ({item.uom})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="col-span-12 md:col-span-5">
                                        <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide flex items-center justify-between">
                                            <span>Scan or Type QR Code</span>
                                            {activeScanItem && (
                                                <span className="text-[10px] font-medium text-blue-600">
                                                    Target: {viewingRequest.items.find(i => i.id.toString() === activeScanItem.toString())?.issueQty || 0} NOS
                                                </span>
                                            )}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                placeholder={activeScanItem ? "Scan serial number..." : "Select item first"}
                                                className="h-11 pr-20 bg-white border-blue-200 focus:ring-blue-500 shadow-sm"
                                                value={scanInputValue}
                                                onChange={(e) => setScanInputValue(e.target.value)}
                                                disabled={!activeScanItem}
                                                onKeyDown={(e) => activeScanItem && handleScanKeyDown(activeScanItem, e)}
                                            />
                                            <div className="absolute right-2 top-2 h-7 px-2 flex items-center justify-center bg-blue-50 rounded text-[10px] font-bold text-blue-500 border border-blue-100 uppercase tracking-tighter">
                                                Enter ↵
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-3">
                                        <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Scanned Counter</Label>
                                        <div className={cn(
                                            "h-11 flex items-center gap-3 px-4 rounded-xl border font-bold text-xs shadow-sm shadow-inner transition-all",
                                            activeScanItem && (scannedSerialsPerItem[activeScanItem]?.length || 0) > 0
                                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                                : "bg-white text-slate-400 border-slate-200"
                                        )}>
                                            <div className="min-w-10 px-2 py-1 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px]">
                                                {activeScanItem ? `${scannedSerialsPerItem[activeScanItem]?.length || 0} CODES` : "-"}
                                            </div>
                                            {activeScanItem && scannedSerialsPerItem[activeScanItem]?.length > 0 && (
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-[10px] text-blue-600 truncate italic">
                                                        Last: {scannedSerialsPerItem[activeScanItem][scannedSerialsPerItem[activeScanItem].length - 1]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Item Name</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3 text-right">Req Qty</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3 text-right text-primary">Avail Qty</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3 text-right w-32 pr-4 text-blue-600">
                                            {isRequestedStatus ? "Issue Qty" : "Issued Qty"}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingRequest.items.map((item) => {
                                        const serialsCount = scannedSerialsPerItem[item.id]?.length || 0;
                                        return (
                                            <TableRow key={item.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                <TableCell className="font-bold text-xs py-4 pl-4">
                                                    {item.itemName}
                                                    {serialsCount > 0 && (
                                                        <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[9px] border-blue-200 text-blue-600 bg-blue-50">
                                                            {serialsCount} SCANNED
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-medium">{item.requestedQty || item.qtyNeeded} {item.uom}</TableCell>
                                                <TableCell className="text-right text-xs font-bold text-primary">{item.availableStock} {item.uom}</TableCell>
                                                <TableCell className="text-right py-2 pr-4">
                                                    {isRequestedStatus ? (
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            className="h-9 text-right text-xs font-bold px-2 w-24 ml-auto border-blue-100 focus:border-blue-300 focus:ring-blue-100"
                                                            value={item.issueQty || ""}
                                                            onChange={(e) => handleIssueQtyChange(item.id, e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-bold text-blue-600">{item.issueQty || 0} {item.uom}</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-slate-50/50 flex flex-row items-center justify-between gap-4">
                        <div className="flex-1">
                            {(isIssuedStatus || viewingRequest.status === "Received Req. by SC") && (
                                <p className="text-[11px] text-muted-foreground italic">
                                    Issued by {viewingRequest.issuedBy} on {viewingRequest.issuedDate ? format(new Date(viewingRequest.issuedDate), "dd/MM/yyyy") : "-"}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsViewModalOpen(false)} className="px-6 h-11 font-bold">
                                Close
                            </Button>
                            {isRequestedStatus && (
                                <Button
                                    className="px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200"
                                    onClick={handleIssueItems}
                                >
                                    Issue Items
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    // ========================================================================
    // RENDER: MAIN COMPONENT
    // ========================================================================

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-visible">
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight">Material Requisitions</h1>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Req No, Work Center..."
                            className="pl-10 h-10 rounded-md border-input bg-background"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                    <Select value={filterStatus} onValueChange={(val) => {
                        setFilterStatus(val as SMRStatus | "all");
                        setCurrentPage(1);
                    }}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Requested Req.">Requested Req.</SelectItem>
                            <SelectItem value="Issued Req. by WH">Issued Req. by WH</SelectItem>
                            <SelectItem value="Received Req. by SC">Received Req. by SC</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</Label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <DatePicker
                                date={dateFilter}
                                setDate={setDateFilter}
                            />
                        </div>
                        {dateFilter && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDateFilter(undefined)}
                                className="h-10 w-10 shrink-0"
                                title="Clear date filter"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* SMR Requests Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Req No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Request Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Department</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No Requisitions found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((request) => (
                                        <TableRow
                                            key={request.id}
                                            className="hover:bg-muted/30 transition-colors border-b last:border-none"
                                        >
                                            {/* SMR No */}
                                            <TableCell className="py-4 font-medium font-mono">
                                                {request.smrNo}
                                            </TableCell>

                                            {/* Request Date */}
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {request.smrRequestDate}
                                            </TableCell>

                                            {/* Work Center */}
                                            <TableCell className="py-4 text-sm font-medium">
                                                {request.workCenter}
                                            </TableCell>

                                            {/* Department */}
                                            <TableCell className="py-4 text-sm font-medium">
                                                {request.department}
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="py-4 text-center">
                                                {getStatusBadge(request.status)}
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="py-4 text-right pr-6">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleView(request)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredRequests.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredRequests.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Detail Popup */}
            {renderDetailPopup()}
        </div>
    );
}
