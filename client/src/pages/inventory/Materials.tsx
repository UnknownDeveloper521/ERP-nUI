import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, CalendarIcon, X, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MaterialRequestItem {
    id: number;
    itemCode: string;
    itemName: string;
    uom: string;
    requestedQty: number;
    availableQty: number;
    issueQty: number;
}

interface MaterialRequest {
    id: number;
    mrNo: string;
    date: string;
    requestedBy: string;
    workCenter: string;
    operation: string;
    status: "Requested to Warehouse" | "Issued by Warehouse" | "Received by Production";
    items: MaterialRequestItem[];
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_MR_REQUESTS: MaterialRequest[] = [
    {
        id: 1,
        mrNo: "MR-2024-001",
        date: "2024-02-15",
        requestedBy: "John Doe",
        workCenter: "WC-001 Cutting Bay",
        operation: "Cutting",
        status: "Requested to Warehouse",
        items: [
            { id: 1, itemCode: "RM-STL-001", itemName: "Steel Sheet 2mm", uom: "KG", requestedQty: 100, availableQty: 250, issueQty: 100 },
            { id: 2, itemCode: "RM-ALU-002", itemName: "Aluminum Plate", uom: "KG", requestedQty: 50, availableQty: 30, issueQty: 30 },
        ]
    },
    {
        id: 2,
        mrNo: "MR-2024-002",
        date: "2024-02-16",
        requestedBy: "Jane Smith",
        workCenter: "WC-002 Welding Station",
        operation: "Welding",
        status: "Requested to Warehouse",
        items: [
            { id: 3, itemCode: "RM-WLD-003", itemName: "Welding Rods", uom: "PKT", requestedQty: 10, availableQty: 50, issueQty: 10 },
        ]
    },
    {
        id: 3,
        mrNo: "MR-2024-003",
        date: "2024-02-14",
        requestedBy: "Mike Ross",
        workCenter: "WC-003 Assembly Line",
        operation: "Assembly",
        status: "Issued by Warehouse",
        items: [
            { id: 4, itemCode: "RM-SCR-004", itemName: "Screws M4", uom: "NOS", requestedQty: 500, availableQty: 1000, issueQty: 500 },
        ]
    }
];

const WORK_CENTERS = ["WC-001 Cutting Bay", "WC-002 Welding Station", "WC-003 Assembly Line", "WC-004 Paint Shop"];

// ============================================================================
// DATE PICKER COMPONENT (Standardized)
// ============================================================================

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
            return format(date, "dd/MM/yyyy");
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
                        "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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
// SEARCHABLE SELECT COMPONENT
// ============================================================================

interface SearchableSelectProps {
    label: string;
    value?: string;
    options: string[];
    onChange: (val: string) => void;
    required?: boolean;
}

function SearchableSelect({ label, value, options, onChange, required = false }: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal border-input"
                    >
                        <span className={cn(!value && "text-muted-foreground")}>
                            {value || `Select ${label}`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInputBorderless placeholder={`Search ${label.toLowerCase()}...`} className="h-9" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    value=""
                                    onSelect={() => {
                                        onChange("");
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                    All {label}s
                                </CommandItem>
                                {options.map((item) => (
                                    <CommandItem
                                        key={item}
                                        value={item}
                                        onSelect={() => {
                                            onChange(item);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === item ? "opacity-100" : "opacity-0")} />
                                        {item}
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Materials() {
    const { toast } = useToast();

    // Listing State
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("Requested to Warehouse");
    const [workCenterFilter, setWorkCenterFilter] = useState("");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Detail View State (Popup)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedMR, setSelectedMR] = useState<MaterialRequest | null>(null);

    // Filter Logic
    const filteredRequests = MOCK_MR_REQUESTS.filter(mr => {
        const matchesSearch = mr.mrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mr.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "All" || mr.status === statusFilter;
        const matchesWorkCenter = !workCenterFilter || mr.workCenter === workCenterFilter;

        let matchesDate = true;
        if (dateFilter) {
            const mrDate = new Date(mr.date);
            mrDate.setHours(0, 0, 0, 0);
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            matchesDate = mrDate.getTime() === filterDate.getTime();
        }

        return matchesSearch && matchesStatus && matchesWorkCenter && matchesDate;
    });

    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const paginatedRequests = filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleOpenDetail = (mr: MaterialRequest) => {
        // Autofill issueQty same as requestedQty when opening
        setSelectedMR({
            ...mr,
            items: mr.items.map(item => ({
                ...item,
                issueQty: item.requestedQty
            }))
        });
        setIsViewModalOpen(true);
    };

    const handleIssueQtyChange = (itemId: number, value: string) => {
        if (!selectedMR) return;
        const qty = parseFloat(value) || 0;
        setSelectedMR({
            ...selectedMR,
            items: selectedMR.items.map(item =>
                item.id === itemId ? { ...item, issueQty: qty } : item
            )
        });
    };

    const handleIssueItems = () => {
        toast({
            title: "Success",
            description: `Items for ${selectedMR?.mrNo} have been issued successfully.`,
        });
        setIsViewModalOpen(false);
        setSelectedMR(null);
    };

    // --------------------------------------------------------------------------
    // RENDER: LISTING VIEW
    // --------------------------------------------------------------------------

    const renderListing = () => (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:w-1/4">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search MR No, Requested By..."
                            className="pl-9 h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full sm:w-1/5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Status</SelectItem>
                            <SelectItem value="Requested to Warehouse">Requested to Warehouse</SelectItem>
                            <SelectItem value="Issued by Warehouse">Issued by Warehouse</SelectItem>
                            <SelectItem value="Received by Production">Received by Production</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full sm:w-1/4">
                    <SearchableSelect
                        label="Work Center"
                        options={WORK_CENTERS}
                        value={workCenterFilter}
                        onChange={setWorkCenterFilter}
                    />
                </div>

                <div className="w-full sm:w-1/5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Date</Label>
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

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Material Requested Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Requested By</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No material requests found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRequests.map((mr) => (
                                        <TableRow key={mr.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4">{formatDate(mr.date)}</TableCell>
                                            <TableCell>{mr.requestedBy}</TableCell>
                                            <TableCell className="font-medium text-primary">{mr.mrNo}</TableCell>
                                            <TableCell>{mr.workCenter}</TableCell>
                                            <TableCell>{mr.operation}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium",
                                                        mr.status === "Requested to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                                        mr.status === "Issued by Warehouse" && "border-blue-500 text-blue-600 bg-blue-50",
                                                        mr.status === "Received by Production" && "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {mr.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handleOpenDetail(mr)}>
                                                    Open
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredRequests.length > 0 && (
                        <div className="flex justify-between items-center px-1 mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length} entries
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

    // --------------------------------------------------------------------------
    // RENDER: DIALOG (POPUP)
    // --------------------------------------------------------------------------

    const renderDetailPopup = () => {
        if (!selectedMR) return null;

        return (
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4">
                        <div className="flex items-center justify-between pr-8">
                            <DialogTitle className="text-xl font-bold flex items-center gap-3">
                                Material Request: {selectedMR.mrNo}
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "font-medium",
                                        selectedMR.status === "Requested to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                        selectedMR.status === "Issued by Warehouse" && "border-blue-500 text-blue-600 bg-blue-50",
                                        selectedMR.status === "Received by Production" && "border-green-500 text-green-600 bg-green-50"
                                    )}
                                >
                                    {selectedMR.status}
                                </Badge>
                            </DialogTitle>
                        </div>
                        <DialogDescription>
                            View and process material requisition items.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                        <div className="md:col-span-2 space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Requested Items</h3>
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableHead className="text-[10px] uppercase font-bold py-2">Item Name</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2">Code</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2 text-right">Req Qty</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2 text-right text-primary">Avail Qty</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2 text-right w-24">Issue Qty</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedMR.items.map((item) => (
                                            <TableRow key={item.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                <TableCell className="font-medium text-xs py-2">{item.itemName}</TableCell>
                                                <TableCell className="text-muted-foreground text-[10px]">{item.itemCode}</TableCell>
                                                <TableCell className="text-right text-xs">{item.requestedQty} {item.uom}</TableCell>
                                                <TableCell className="text-right text-xs font-medium text-primary">{item.availableQty} {item.uom}</TableCell>
                                                <TableCell className="text-right py-1">
                                                    <Input
                                                        type="number"
                                                        className="h-7 text-right text-xs font-medium px-2"
                                                        value={item.issueQty}
                                                        onChange={(e) => handleIssueQtyChange(item.id, e.target.value)}
                                                        max={item.availableQty}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">MR Information</h3>
                            <div className="bg-muted/20 p-4 rounded-lg border space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Requested Date:</span>
                                    <span className="font-medium text-right">{formatDate(selectedMR.date)}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Requested By:</span>
                                    <span className="font-medium text-right">{selectedMR.requestedBy}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Work Center:</span>
                                    <span className="font-medium text-right">{selectedMR.workCenter}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Operation:</span>
                                    <span className="font-medium text-right">{selectedMR.operation}</span>
                                </div>

                                <div className="pt-4 mt-2 border-t">
                                    <Button
                                        className="w-full h-10 bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
                                        onClick={handleIssueItems}
                                        disabled={selectedMR.status !== 'Requested to Warehouse'}
                                    >
                                        Issue Items
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Materials</h1>
                <p className="text-muted-foreground">Manage material requests and store operations.</p>
            </div>

            <Tabs defaultValue="material-requests" className="w-full flex-1 flex flex-col min-h-0">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                            value="material-requests"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Material Requests
                        </TabsTrigger>
                        <TabsTrigger
                            value="stock-status"
                            disabled
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Stock Status
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="material-requests" className="m-0 pt-6 h-full min-h-0 overflow-auto">
                    {renderListing()}
                </TabsContent>
            </Tabs>

            {renderDetailPopup()}
        </div>
    );
}
