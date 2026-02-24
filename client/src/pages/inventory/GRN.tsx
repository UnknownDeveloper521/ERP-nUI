import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, CalendarIcon, Plus, Eye, Edit, FileCheck, Trash2, ChevronDown } from "lucide-react";
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

const getCurrentDateForInput = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GRNItem {
    id: number;
    itemCode: string;
    itemName: string;
    uom: string;
    receivedQty: number;
    orderedQty?: number;
    previouslyReceivedQty?: number;
    pendingQty?: number;
    batchNo?: string;
    lineRemarks?: string;
}

interface GRN {
    id: number;
    grnNo: string;
    grnDate: string;
    grnType: "Non-PO" | "PO-Based";
    warehouse: string;
    supplier: string;
    totalItems: number;
    status: "Draft" | "Submitted GRN" | "Cancelled";
    receivedBy: string;
    remarks?: string;
    receiptType?: "Scrap" | "Invoice";
    invoiceNo?: string;
    poNo?: string;
    poDate?: string;
    items: GRNItem[];
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_GRNS: GRN[] = [
    {
        id: 1,
        grnNo: "GRN-2024-001",
        grnDate: "2024-02-15",
        grnType: "PO-Based",
        warehouse: "Main Warehouse",
        supplier: "ABC Suppliers Ltd",
        totalItems: 2,
        status: "Submitted GRN",
        receivedBy: "Admin User",
        remarks: "All items received in good condition",
        poNo: "PO-2024-001",
        poDate: "2024-02-10",
        items: [
            { id: 1, itemCode: "RM-STL-001", itemName: "Steel Sheet 2mm", uom: "KG", receivedQty: 100, orderedQty: 100, previouslyReceivedQty: 0, pendingQty: 0, batchNo: "BATCH-001", lineRemarks: "" },
            { id: 2, itemCode: "RM-ALU-002", itemName: "Aluminum Plate", uom: "KG", receivedQty: 50, orderedQty: 50, previouslyReceivedQty: 0, pendingQty: 0, batchNo: "", lineRemarks: "" },
        ]
    },
    {
        id: 2,
        grnNo: "GRN-2024-002",
        grnDate: "2024-02-16",
        grnType: "Non-PO",
        warehouse: "Production Store",
        supplier: "Scrap",
        totalItems: 1,
        status: "Draft",
        receivedBy: "Admin User",
        receiptType: "Scrap",
        remarks: "Scrap material from production",
        items: [
            { id: 1, itemCode: "RM-SCR-001", itemName: "Scrap Steel", uom: "KG", receivedQty: 25, batchNo: "", lineRemarks: "" },
        ]
    },
    {
        id: 3,
        grnNo: "GRN-2024-003",
        grnDate: "2024-02-17",
        grnType: "Non-PO",
        warehouse: "Main Warehouse",
        supplier: "DEF Suppliers",
        totalItems: 1,
        status: "Draft",
        receivedBy: "Admin User",
        receiptType: "Invoice",
        invoiceNo: "INV-2024-123",
        items: [
            { id: 1, itemCode: "RM-WLD-003", itemName: "Welding Rods", uom: "PKT", receivedQty: 10, batchNo: "BATCH-WLD-001", lineRemarks: "" },
        ]
    },
];

const WAREHOUSES = ["Main Warehouse", "Production Store", "Finished Goods Store"];
const SUPPLIERS = ["ABC Suppliers Ltd", "XYZ Scrap Dealers", "DEF Suppliers", "GHI Materials Co"];
const PO_NUMBERS = ["PO-2024-001", "PO-2024-002", "PO-2024-003"];
const ITEMS = [
    { code: "RM-STL-001", name: "Steel Sheet 2mm", uom: "KG", isBatchTracked: true },
    { code: "RM-ALU-002", name: "Aluminum Plate", uom: "KG", isBatchTracked: false },
    { code: "RM-WLD-003", name: "Welding Rods", uom: "PKT", isBatchTracked: true },
    { code: "RM-SCR-001", name: "Scrap Steel", uom: "KG", isBatchTracked: false },
];

// ============================================================================
// DATE PICKER COMPONENT
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
    label?: string;
    value?: string;
    options: string[];
    onChange: (val: string) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
}

function SearchableSelect({ label, value, options, onChange, placeholder, required = false, disabled = false }: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2">
            {label && <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="w-full justify-between h-10 font-normal border-input"
                    >
                        <span className={cn(!value && "text-muted-foreground")}>
                            {value || placeholder || `Select ${label}`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInputBorderless placeholder={`Search...`} className="h-9" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {!required && (
                                    <CommandItem
                                        value=""
                                        onSelect={() => {
                                            onChange("");
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                        All
                                    </CommandItem>
                                )}
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

export default function GRN() {
    const { toast } = useToast();

    // Listing State
    const [grns, setGrns] = useState<GRN[]>(MOCK_GRNS);
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("");
    const [grnTypeFilter, setGrnTypeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
    const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<GRN>>({
        grnType: "Non-PO",
        warehouse: "",
        grnDate: getCurrentDateForInput(),
        receivedBy: "Admin User",
        remarks: "",
        receiptType: "Invoice",
        supplier: "",
        invoiceNo: "",
        poNo: "",
        items: [],
        status: "Draft"
    });

    // Filter Logic
    const filteredGRNs = grns.filter(grn => {
        const matchesSearch = grn.grnNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            grn.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (grn.poNo && grn.poNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (grn.invoiceNo && grn.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesWarehouse = !warehouseFilter || grn.warehouse === warehouseFilter;
        const matchesType = !grnTypeFilter || grn.grnType === grnTypeFilter;
        const matchesStatus = !statusFilter || grn.status === statusFilter;

        return matchesSearch && matchesWarehouse && matchesType && matchesStatus;
    });

    const totalPages = Math.ceil(filteredGRNs.length / itemsPerPage);
    const paginatedGRNs = filteredGRNs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Handlers
    const handleClearFilters = () => {
        setSearchTerm("");
        setWarehouseFilter("");
        setGrnTypeFilter("");
        setStatusFilter("");
        setCurrentPage(1);
    };

    const handleCreateNew = () => {
        setModalMode("create");
        setFormData({
            grnType: "Non-PO",
            warehouse: "",
            grnDate: getCurrentDateForInput(),
            receivedBy: "Admin User",
            remarks: "",
            receiptType: "Invoice",
            supplier: "",
            invoiceNo: "",
            poNo: "",
            items: [],
            status: "Draft"
        });
        setIsModalOpen(true);
    };

    const handleView = (grn: GRN) => {
        setModalMode("view");
        setSelectedGRN(grn);
        setFormData(grn);
        setIsModalOpen(true);
    };

    const handleEdit = (grn: GRN) => {
        setModalMode("edit");
        setSelectedGRN(grn);
        setFormData(grn);
        setIsModalOpen(true);
    };

    const handlePostGRN = (grn: GRN) => {
        setGrns(grns.map(g => g.id === grn.id ? { ...g, status: "Submitted GRN" } : g));
        toast({
            title: "Success",
            description: `GRN ${grn.grnNo} has been submitted successfully.`,
        });
    };

    const handleSaveDraft = () => {
        if (modalMode === "create") {
            const newGRN: GRN = {
                id: grns.length + 1,
                grnNo: `GRN-2024-${String(grns.length + 1).padStart(3, '0')}`,
                grnDate: formData.grnDate || getCurrentDateForInput(),
                grnType: formData.grnType as "Non-PO" | "PO-Based",
                warehouse: formData.warehouse || "",
                supplier: formData.supplier || "",
                totalItems: formData.items?.length || 0,
                status: "Draft",
                receivedBy: formData.receivedBy || "Admin User",
                remarks: formData.remarks,
                receiptType: formData.receiptType,
                invoiceNo: formData.invoiceNo,
                poNo: formData.poNo,
                poDate: formData.poDate,
                items: formData.items || [],
            };
            setGrns([...grns, newGRN]);
        } else if (modalMode === "edit" && selectedGRN) {
            setGrns(grns.map(g => g.id === selectedGRN.id ? { ...g, ...formData } : g));
        }
        toast({
            title: "Success",
            description: "GRN saved as draft successfully.",
        });
        setIsModalOpen(false);
    };

    const handlePostGRNFromModal = () => {
        if (modalMode === "create") {
            const newGRN: GRN = {
                id: grns.length + 1,
                grnNo: `GRN-2024-${String(grns.length + 1).padStart(3, '0')}`,
                grnDate: formData.grnDate || getCurrentDateForInput(),
                grnType: formData.grnType as "Non-PO" | "PO-Based",
                warehouse: formData.warehouse || "",
                supplier: formData.supplier || "",
                totalItems: formData.items?.length || 0,
                status: "Submitted GRN",
                receivedBy: formData.receivedBy || "Admin User",
                remarks: formData.remarks,
                receiptType: formData.receiptType,
                invoiceNo: formData.invoiceNo,
                poNo: formData.poNo,
                poDate: formData.poDate,
                items: formData.items || [],
            };
            setGrns([...grns, newGRN]);
        } else if (modalMode === "edit" && selectedGRN) {
            setGrns(grns.map(g => g.id === selectedGRN.id ? { ...g, ...formData, status: "Submitted GRN" } : g));
        }
        toast({
            title: "Success",
            description: "GRN submitted successfully. Stock updated.",
        });
        setIsModalOpen(false);
    };

    const handleCancelGRN = () => {
        if (selectedGRN) {
            setGrns(grns.map(g => g.id === selectedGRN.id ? { ...g, status: "Cancelled" } : g));
            toast({
                title: "Success",
                description: `GRN ${selectedGRN.grnNo} has been cancelled.`,
            });
            setIsModalOpen(false);
        }
    };

    const handleDeleteGRN = () => {
        if (selectedGRN) {
            setGrns(grns.filter(g => g.id !== selectedGRN.id));
            toast({
                title: "Success",
                description: `GRN ${selectedGRN.grnNo} has been deleted successfully.`,
            });
            setIsDeleteDialogOpen(false);
            setIsModalOpen(false);
        }
    };

    const handleAddItem = () => {
        const newItem: GRNItem = {
            id: Date.now(), // Use timestamp to ensure unique ID
            itemCode: "",
            itemName: "",
            uom: "",
            receivedQty: 0,
            batchNo: "",
            lineRemarks: ""
        };
        setFormData({
            ...formData,
            items: [...(formData.items || []), newItem]
        });
    };

    const handleRemoveItem = (itemId: number) => {
        setFormData({
            ...formData,
            items: formData.items?.filter(item => item.id !== itemId) || []
        });
    };

    const handleItemChange = (itemId: number, field: keyof GRNItem, value: any) => {
        setFormData({
            ...formData,
            items: formData.items?.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            ) || []
        });
    };

    // Validation function to check if form is valid for submission
    const isFormValid = (): boolean => {
        // Basic validation - can add more checks here if needed
        return true;
    };

    const handleItemSelect = (itemId: number, itemCode: string) => {
        // Check for duplicate item (only for Non-PO GRN)
        if (formData.grnType === "Non-PO") {
            const isDuplicate = formData.items?.some(item => 
                item.id !== itemId && item.itemCode === itemCode
            );
            
            if (isDuplicate) {
                toast({
                    title: "Duplicate Item",
                    description: "Item already added. Please update quantity instead.",
                    variant: "destructive",
                });
                return;
            }
        }

        const selectedItem = ITEMS.find(i => i.code === itemCode);
        if (selectedItem) {
            setFormData({
                ...formData,
                items: formData.items?.map(item =>
                    item.id === itemId ? {
                        ...item,
                        itemCode: selectedItem.code,
                        itemName: selectedItem.name,
                        uom: selectedItem.uom,
                        batchNo: item.batchNo || "",
                        lineRemarks: item.lineRemarks || ""
                    } : item
                ) || []
            });
        }
    };

    const handlePOSelect = (poNo: string) => {
        // Mock PO data auto-fill
        setFormData({
            ...formData,
            poNo,
            supplier: "ABC Suppliers Ltd",
            poDate: "2024-02-10",
            items: [
                { id: 1, itemCode: "RM-STL-001", itemName: "Steel Sheet 2mm", uom: "KG", receivedQty: 0, orderedQty: 100, previouslyReceivedQty: 0, pendingQty: 100, batchNo: "", lineRemarks: "" },
                { id: 2, itemCode: "RM-ALU-002", itemName: "Aluminum Plate", uom: "KG", receivedQty: 0, orderedQty: 50, previouslyReceivedQty: 0, pendingQty: 50, batchNo: "", lineRemarks: "" },
            ]
        });
    };

    // ============================================================================
    // RENDER: LISTING VIEW
    // ============================================================================

    const renderListing = () => (
        <div className="flex flex-col gap-6">
            {/* Filter Bar */}
            <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="w-full sm:w-1/4">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="GRN No / PO No / Invoice No / Item"
                                className="pl-9 h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="w-full sm:w-1/5">
                        <SearchableSelect
                            label="Warehouse"
                            options={WAREHOUSES}
                            value={warehouseFilter}
                            onChange={setWarehouseFilter}
                        />
                    </div>

                    <div className="w-full sm:w-1/5">
                        <SearchableSelect
                            label="GRN Type"
                            options={["Non-PO", "PO-Based"]}
                            value={grnTypeFilter}
                            onChange={setGrnTypeFilter}
                        />
                    </div>

                    <div className="w-full sm:w-1/5">
                        <SearchableSelect
                            label="Status"
                            options={["Draft", "Submitted GRN", "Cancelled"]}
                            value={statusFilter}
                            onChange={setStatusFilter}
                        />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Button onClick={handleCreateNew} className="h-10 gap-2">
                            <Plus className="h-4 w-4" />
                            Create GRN
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">GRN No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">GRN Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">GRN Type</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Supplier/Source</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Total Items</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedGRNs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No GRN records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedGRNs.map((grn) => (
                                        <TableRow key={grn.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="font-medium text-primary">{grn.grnNo}</TableCell>
                                            <TableCell>{formatDate(grn.grnDate)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(
                                                    grn.grnType === "PO-Based" ? "border-blue-500 text-blue-600 bg-blue-50" : "border-purple-500 text-purple-600 bg-purple-50"
                                                )}>
                                                    {grn.grnType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{grn.warehouse}</TableCell>
                                            <TableCell>{grn.supplier}</TableCell>
                                            <TableCell>{grn.totalItems}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(
                                                    grn.status === "Draft" && "border-amber-500 text-amber-600 bg-amber-50",
                                                    grn.status === "Submitted GRN" && "border-green-500 text-green-600 bg-green-50",
                                                    grn.status === "Cancelled" && "border-red-500 text-red-600 bg-red-50"
                                                )}>
                                                    {grn.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleView(grn)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {grn.status === "Draft" && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(grn)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredGRNs.length > 0 && (
                        <div className="flex justify-between items-center px-1 mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredGRNs.length)} of {filteredGRNs.length} entries
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

    // ============================================================================
    // RENDER: MODAL (CREATE/EDIT/VIEW)
    // ============================================================================

    const renderModal = () => {
        const isViewMode = modalMode === "view";
        const isDraft = formData.status === "Draft";
        const isNonPO = formData.grnType === "Non-PO";
        const isPOBased = formData.grnType === "PO-Based";
        const isInvoice = formData.receiptType === "Invoice";

        return (
            <>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-xl font-bold">
                            {modalMode === "create" && "Create GRN"}
                            {modalMode === "edit" && `Edit GRN - ${selectedGRN?.grnNo}`}
                            {modalMode === "view" && `View GRN - ${selectedGRN?.grnNo}`}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* SECTION A: BASIC DETAILS */}
                        <Card>
                            <CardContent className="pt-6">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Basic Details</h3>
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">GRN Type <span className="text-red-500">*</span></Label>
                                        <Select
                                            value={formData.grnType}
                                            onValueChange={(val) => setFormData({ ...formData, grnType: val as "Non-PO" | "PO-Based", items: [] })}
                                            disabled={isViewMode}
                                        >
                                            <SelectTrigger className="h-10 mt-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Non-PO">Non-PO</SelectItem>
                                                <SelectItem value="PO-Based">PO-Based</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <SearchableSelect
                                            label="Warehouse / Location"
                                            options={WAREHOUSES}
                                            value={formData.warehouse}
                                            onChange={(val) => setFormData({ ...formData, warehouse: val })}
                                            required
                                            disabled={isViewMode}
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Received Date <span className="text-red-500">*</span></Label>
                                        <DatePicker
                                            date={formData.grnDate ? new Date(formData.grnDate) : undefined}
                                            setDate={(d) => setFormData({ ...formData, grnDate: d ? format(d, "yyyy-MM-dd") : "" })}
                                            disabled={isViewMode}
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Received By</Label>
                                        <Input
                                            value={formData.receivedBy}
                                            readOnly
                                            className="h-10 mt-2 bg-muted"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remarks</Label>
                                    <Textarea
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        disabled={isViewMode}
                                        className="mt-2 min-h-[60px]"
                                        placeholder="Enter any remarks..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* SECTION B: CONDITIONAL DETAILS */}
                        {isNonPO && (
                            <Card>
                                <CardContent className="pt-6">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Receipt Details</h3>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div>
                                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receipt Type <span className="text-red-500">*</span></Label>
                                            <Select
                                                value={formData.receiptType}
                                                onValueChange={(val) => setFormData({ ...formData, receiptType: val as "Scrap" | "Invoice" })}
                                                disabled={isViewMode}
                                            >
                                                <SelectTrigger className="h-10 mt-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Scrap">Scrap</SelectItem>
                                                    <SelectItem value="Invoice">Invoice</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {isInvoice && (
                                            <>
                                                <div>
                                                    <SearchableSelect
                                                        label="Supplier"
                                                        options={SUPPLIERS}
                                                        value={formData.supplier}
                                                        onChange={(val) => setFormData({ ...formData, supplier: val })}
                                                        required
                                                        disabled={isViewMode}
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice No <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        value={formData.invoiceNo}
                                                        onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                                                        disabled={isViewMode}
                                                        className="h-10 mt-2"
                                                        placeholder="Enter invoice number"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isPOBased && (
                            <Card>
                                <CardContent className="pt-6">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">PO Details</h3>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div>
                                            <SearchableSelect
                                                label="PO No"
                                                options={PO_NUMBERS}
                                                value={formData.poNo}
                                                onChange={handlePOSelect}
                                                required
                                                disabled={isViewMode}
                                            />
                                        </div>

                                        {formData.poNo && (
                                            <>
                                                <div>
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</Label>
                                                    <Input
                                                        value={formData.supplier}
                                                        readOnly
                                                        className="h-10 mt-2 bg-muted"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PO Date</Label>
                                                    <Input
                                                        value={formData.poDate ? formatDate(formData.poDate) : ""}
                                                        readOnly
                                                        className="h-10 mt-2 bg-muted"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ITEMS TABLE */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Items</h3>
                                    {isNonPO && !isViewMode && (
                                        <Button size="sm" onClick={handleAddItem} className="h-8">
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Item
                                        </Button>
                                    )}
                                </div>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableHead className="text-[10px] uppercase font-bold">Item Name</TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold">UOM</TableHead>
                                                {isPOBased && (
                                                    <>
                                                        <TableHead className="text-[10px] uppercase font-bold text-right">Ordered Qty</TableHead>
                                                        <TableHead className="text-[10px] uppercase font-bold text-right">Prev Received</TableHead>
                                                        <TableHead className="text-[10px] uppercase font-bold text-right">Pending Qty</TableHead>
                                                    </>
                                                )}
                                                <TableHead className="text-[10px] uppercase font-bold text-right">
                                                    {isPOBased ? "Receiving Now" : "Received Qty"} <span className="text-red-500">*</span>
                                                </TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold">Line Remarks</TableHead>
                                                {!isViewMode && <TableHead className="text-[10px] uppercase font-bold text-right">Action</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(!formData.items || formData.items.length === 0) ? (
                                                <TableRow>
                                                    <TableCell colSpan={isPOBased ? 8 : 5} className="h-24 text-center text-muted-foreground">
                                                        {isPOBased ? "Select a PO to load items" : "No items added. Click 'Add Item' to begin."}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                formData.items.map((item) => {
                                                    const selectedItemData = ITEMS.find(i => i.code === item.itemCode);
                                                    const isBatchTracked = selectedItemData?.isBatchTracked;

                                                    return (
                                                        <TableRow key={item.id}>
                                                            {/* Item Name column */}
                                                            <TableCell className="py-2">
                                                                {isNonPO && !isViewMode ? (
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button
                                                                                variant="outline"
                                                                                role="combobox"
                                                                                className="h-8 text-xs w-48 justify-between font-normal border-input"
                                                                            >
                                                                                <span className={cn(!item.itemName && "text-muted-foreground")}>
                                                                                    {item.itemName || "Select item name"}
                                                                                </span>
                                                                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                                            <Command>
                                                                                <CommandInputBorderless placeholder="Search item..." className="h-9 text-xs" />
                                                                                <CommandList className="max-h-[108px] overflow-y-auto">
                                                                                    <CommandEmpty className="text-xs py-2">No item found.</CommandEmpty>
                                                                                    <CommandGroup>
                                                                                        {ITEMS.map((itm) => {
                                                                                            // Check if item is already selected in other rows
                                                                                            const isAlreadySelected = formData.items?.some(
                                                                                                existingItem => existingItem.id !== item.id && existingItem.itemCode === itm.code
                                                                                            );
                                                                                            return (
                                                                                                <CommandItem
                                                                                                    key={itm.code}
                                                                                                    value={itm.name}
                                                                                                    onSelect={() => {
                                                                                                        if (!isAlreadySelected) {
                                                                                                            handleItemSelect(item.id, itm.code);
                                                                                                        }
                                                                                                    }}
                                                                                                    disabled={isAlreadySelected}
                                                                                                    className={cn(
                                                                                                        "cursor-pointer text-xs",
                                                                                                        isAlreadySelected && "opacity-50 cursor-not-allowed"
                                                                                                    )}
                                                                                                >
                                                                                                    <Check className={cn("mr-2 h-3 w-3", item.itemName === itm.name ? "opacity-100" : "opacity-0")} />
                                                                                                    {itm.name}
                                                                                                </CommandItem>
                                                                                            );
                                                                                        })}
                                                                                    </CommandGroup>
                                                                                </CommandList>
                                                                            </Command>
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                ) : (
                                                                    <span className="text-xs">{item.itemName}</span>
                                                                )}
                                                            </TableCell>
                                                            
                                                            <TableCell className="text-xs">{item.uom}</TableCell>
                                                            {isPOBased && (
                                                                <>
                                                                    <TableCell className="text-right text-xs">{item.orderedQty}</TableCell>
                                                                    <TableCell className="text-right text-xs">{item.previouslyReceivedQty}</TableCell>
                                                                    <TableCell className="text-right text-xs font-medium text-primary">{item.pendingQty}</TableCell>
                                                                </>
                                                            )}
                                                            <TableCell className="py-1">
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 text-right text-xs w-20"
                                                                    value={item.receivedQty || 0}
                                                                    onChange={(e) => handleItemChange(item.id, "receivedQty", parseFloat(e.target.value) || 0)}
                                                                    disabled={isViewMode}
                                                                />
                                                            </TableCell>
                                                            
                                                            <TableCell className="py-1">
                                                                <Input
                                                                    className="h-8 text-xs"
                                                                    value={item.lineRemarks || ""}
                                                                    onChange={(e) => handleItemChange(item.id, "lineRemarks", e.target.value)}
                                                                    disabled={isViewMode}
                                                                    placeholder="Remarks"
                                                                />
                                                            </TableCell>
                                                            {!isViewMode && (
                                                                <TableCell className="text-right py-1">
                                                                    {isNonPO && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-red-600"
                                                                            onClick={() => handleRemoveItem(item.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            )}
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Summary */}
                                {formData.items && formData.items.length > 0 && (
                                    <div className="mt-4 flex justify-end">
                                        <div className="bg-muted/20 p-4 rounded-lg border space-y-2 min-w-[250px]">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Items:</span>
                                                <span className="font-semibold">{formData.items.length}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Qty:</span>
                                                <span className="font-semibold">{formData.items.reduce((sum, item) => sum + item.receivedQty, 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Footer Actions */}
                    <DialogFooter className="border-t pt-4">
                        {isViewMode ? (
                            <div className="flex justify-between w-full">
                                <Button 
                                    variant="destructive" 
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                >
                                    Delete GRN
                                </Button>
                                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        ) : (
                            <div className="flex justify-end gap-2 w-full">
                                {isDraft && modalMode === "edit" && (
                                    <Button variant="destructive" onClick={handleCancelGRN}>
                                        Cancel GRN
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                                    Close
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={handleSaveDraft}
                                    disabled={!isFormValid()}
                                >
                                    Save Draft
                                </Button>
                                <Button 
                                    onClick={handlePostGRNFromModal}
                                    disabled={!isFormValid()}
                                >
                                    Submit
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete GRN {selectedGRN?.grnNo} and remove all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteGRN} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </>
        );
    };

    // ============================================================================
    // MAIN RENDER
    // ============================================================================

    return (
        <div className="flex flex-col gap-6">
            {renderListing()}
            {renderModal()}
        </div>
    );
}
