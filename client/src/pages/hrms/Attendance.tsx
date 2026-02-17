import React, { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsUpDown, Check, X, ChevronDown, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

// --- Interfaces ---
interface Attendance {
    id: string;
    date: string; // YYYY-MM-DD
    status: "Present" | "Absent" | null;
}

interface DayAttendance {
    date: string;
    status: "Present" | "Absent" | null;
    employeeName?: string;
    department?: string;
    workLocation?: string;
}

interface HRRecord {
    id: string;
    employeeName: string;
    date: string;
    department: string;
    workLocation: string;
    status: "Present" | "Absent" | null;
}

interface BulkRecord {
    id: string;
    employeeName: string;
    department: string;
    workLocation: string;
    date: string; // YYYY-MM-DD
    status: "Present" | "Absent" | null;
}

// --- Reusable Searchable Combobox Component ---

interface SearchableSelectProps {
    label: string;
    value?: string;
    options: string[];
    onChange: (val: string) => void;
    required?: boolean;
    disabled?: boolean;
}

function SearchableSelect({
    label,
    value,
    options,
    onChange,
    required = false,
    disabled = false,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2">
            <Label>
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal border-input"
                        disabled={disabled}
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
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === item ? "opacity-100" : "opacity-0"
                                            )}
                                        />
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

export default function AttendancePage() {
    const { toast } = useToast();
    // --- Router State ---
    const [location, setLocation] = useLocation();
    const searchString = useSearch();
    const searchParams = new URLSearchParams(searchString);
    const currentTab = searchParams.get("tab") || "record";

    const handleTabChange = (value: string) => {
        const newParams = new URLSearchParams(searchString);
        newParams.set("tab", value);
        setLocation(`${location}?${newParams.toString()}`);
    };

    // --- State ---
    // ⚠️ SAFE GUARD: Added ONE mock attendance record to prevent runtime crashes
    // This ensures attendance list never crashes when empty
    // ============================================================================
    const [attendanceList, setAttendanceList] = useState<Attendance[]>([
        {
            id: "att-001",
            date: "2026-02-10",
            status: "Present"
        }
    ]);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Modal state (unused now, keeping for potential future use or removing if completely unnecessary)
    // Removed isDialogOpen and selectedDay

    // --- HR View State ---
    const [hrDepartment, setHrDepartment] = useState("All Departments");
    const [hrWorkLocation, setHrWorkLocation] = useState("All Locations");
    const [hrDate, setHrDate] = useState<Date | undefined>(undefined);
    const [hrSearchTerm, setHrSearchTerm] = useState("");
    const [hrSearchResults, setHrSearchResults] = useState<HRRecord[]>([]);



    // Formatting date for display
    const formatDateDisplay = (dateStr: string) => {
        try {
            return format(parseISO(dateStr), "MMMM dd, yyyy");
        } catch {
            return dateStr;
        }
    };

    // Filter state
    const [recordDate, setRecordDate] = useState<Date>(new Date());

    // Group attendance list by day
    const getGroupedAttendance = (): DayAttendance[] => {
        const dateStr = format(recordDate, "yyyy-MM-dd");

        const dayRecords: DayAttendance[] = [];

        attendanceList.forEach(record => {
            if (record.date === dateStr) {
                dayRecords.push({
                    date: record.date,
                    status: record.status
                });
            }
        });

        return dayRecords;
    };

    const groupedAttendance = getGroupedAttendance();

    // --- Handlers ---

    const handleSetStatus = (status: "Present" | "Absent", dateStr?: string) => {
        const targetDate = dateStr || format(new Date(), "yyyy-MM-dd");

        setAttendanceList((prev) => {
            const existingIndex = prev.findIndex(r => r.date === targetDate);
            if (existingIndex !== -1) {
                const newList = [...prev];
                newList[existingIndex] = { ...newList[existingIndex], status };
                return newList;
            } else {
                return [{ id: crypto.randomUUID(), date: targetDate, status }, ...prev];
            }
        });
    };



    // --- HR View Logic ---
    // ⚠️ SAFE GUARD: Added ONE mock HR record to prevent runtime crashes
    // This ensures HR view never crashes when empty
    // ============================================================================
    const HR_MOCK_DATA: HRRecord[] = [
        {
            id: "hr-001",
            employeeName: "John Doe",
            date: "2026-02-10",
            department: "Engineering",
            workLocation: "Head Office",
            status: "Present"
        }
    ];

    useEffect(() => {
        const results = HR_MOCK_DATA.filter(record => {
            const matchDept = hrDepartment && hrDepartment !== "All Departments" ? record.department === hrDepartment : true;
            const matchLocation = hrWorkLocation && hrWorkLocation !== "All Locations" ? record.workLocation === hrWorkLocation : true;
            const matchDate = hrDate ? record.date === format(hrDate, "yyyy-MM-dd") : true;
            const term = hrSearchTerm.toLowerCase().trim();
            const knownDepartments = ["it", "hr", "finance", "sales"];
            let matchSearch = true;
            if (term) {
                if (knownDepartments.includes(term)) {
                    matchSearch = record.department.toLowerCase() === term;
                } else {
                    matchSearch = record.employeeName.toLowerCase().includes(term) ||
                        record.id.toLowerCase().includes(term) ||
                        record.department.toLowerCase().includes(term) ||
                        record.workLocation.toLowerCase().includes(term);
                }
            }
            return matchDept && matchLocation && matchDate && matchSearch;
        });
        setHrSearchResults(results);
    }, [hrDepartment, hrWorkLocation, hrDate, hrSearchTerm]);


    // --- Bulk Attendance Logic ---
    const [bulkDate, setBulkDate] = useState<Date>(new Date());
    const [bulkSearchTerm, setBulkSearchTerm] = useState("");
    const [isBulkDatePickerOpen, setIsBulkDatePickerOpen] = useState(false);

    // Static list of employees for bulk attendance
    const BULK_EMPLOYEES = [
        { id: "b1", employeeName: "Alice Johnson", department: "IT", workLocation: "Plant 1" },
        { id: "b2", employeeName: "Bob Smith", department: "HR", workLocation: "Plant 2" },
        { id: "b3", employeeName: "Charlie Brown", department: "Sales", workLocation: "Plant 3" },
        { id: "b4", employeeName: "Diana Ross", department: "Finance", workLocation: "Plant 1" },
        { id: "b5", employeeName: "Ethan Hunt", department: "IT", workLocation: "Plant 2" },
    ];

    // Map to store attendance status indexed by date and employee ID
    // Record<dateString, Record<employeeId, status>>
    const [bulkAttendanceMap, setBulkAttendanceMap] = useState<Record<string, Record<string, "Present" | "Absent" | null>>>({});

    const handleBulkSetStatus = (id: string, status: "Present" | "Absent") => {
        const dateStr = format(bulkDate, "yyyy-MM-dd");
        setBulkAttendanceMap(prev => ({
            ...prev,
            [dateStr]: {
                ...(prev[dateStr] || {}),
                [id]: status
            }
        }));
    };



    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Attendance</h1>
                <p className="text-muted-foreground">
                    Track your attendance and overtime
                </p>
            </div>

            <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none">
                        <TabsTrigger
                            value="record"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-colors hover:text-foreground"
                        >
                            Attendance Record
                        </TabsTrigger>
                        <TabsTrigger
                            value="hr-view"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-colors hover:text-foreground"
                        >
                            HR View
                        </TabsTrigger>
                        <TabsTrigger
                            value="bulk-attendance"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-colors hover:text-foreground"
                        >
                            Bulk Attendance
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* --- Tab 1: Attendance Record --- */}
                <TabsContent value="record" className="space-y-4">
                    <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg">Attendance Record</CardTitle>
                                    <CardDescription>View your attendance log for a specific date</CardDescription>
                                </div>
                                <div className="w-[240px]">
                                    <DatePicker
                                        date={recordDate}
                                        setDate={(d) => d && setRecordDate(d)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="bg-card border rounded-lg overflow-hidden shadow-sm mx-6 mb-6">
                                {/* Header Row */}
                                <div className="grid grid-cols-12 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                                    <div className="col-span-8">Date</div>
                                    <div className="col-span-4 text-right pr-6">Mark Present</div>
                                </div>

                                {/* Rows */}
                                <div className="divide-y text-sm">
                                    {groupedAttendance.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            No attendance record found for {format(recordDate, "MMMM dd, yyyy")}.
                                            Use the checkbox to mark your status.
                                            {/* For current date, show the checkbox even if no record exists in list yet */}
                                            {isSameDay(recordDate, new Date()) && (
                                                <div className="mt-4 flex justify-center">
                                                    <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-lg">
                                                        <span className="font-medium">Mark Attendance for Today:</span>
                                                        <Checkbox
                                                            checked={false}
                                                            onCheckedChange={(checked) =>
                                                                handleSetStatus(checked ? "Present" : "Absent", format(recordDate, "yyyy-MM-dd"))
                                                            }
                                                            className="h-6 w-6 border-2"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        groupedAttendance.map((record, index) => (
                                            <div
                                                key={record.date + index}
                                                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors group"
                                            >
                                                <div className="col-span-8 font-medium text-foreground">
                                                    {formatDateDisplay(record.date)}
                                                </div>
                                                <div className="col-span-4 text-right flex justify-end pr-8">
                                                    <Checkbox
                                                        checked={record.status === "Present"}
                                                        onCheckedChange={(checked) =>
                                                            handleSetStatus(checked ? "Present" : "Absent", record.date)
                                                        }
                                                        className="h-5 w-5 border-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* Save Button */}
                                <div className="flex justify-end p-6 border-t bg-muted/10">
                                    <Button
                                        onClick={() => {
                                            toast({
                                                title: "Attendance Saved",
                                                description: "Attendance records updated successfully.",
                                            });
                                            console.log("Saving Attendance List:", attendanceList);
                                        }}
                                        disabled={!groupedAttendance.some(r => r.status === "Present")}
                                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save className="h-4 w-4" />
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* --- Tab 3: HR View --- */}
                <TabsContent value="hr-view" className="space-y-4">
                    <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
                        <CardContent className="p-6">
                            {/* Filter Section */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                                <SearchableSelect
                                    label="Department"
                                    value={hrDepartment}
                                    options={["All Departments", "IT", "HR", "Finance", "Sales", "Engineering", "Marketing", "Operations"]}
                                    onChange={setHrDepartment}
                                />
                                <SearchableSelect
                                    label="Work Location"
                                    value={hrWorkLocation}
                                    options={["All Locations", "Plant 1", "Plant 2", "Plant 3", "HQ Office", "Remote"]}
                                    onChange={setHrWorkLocation}
                                />
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Date</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <DatePicker
                                                date={hrDate}
                                                setDate={setHrDate}
                                            />
                                        </div>
                                        {hrDate && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setHrDate(undefined)}
                                                className="h-10 w-10 shrink-0"
                                                title="Clear date filter"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Search</label>
                                    <Input
                                        placeholder="Search"
                                        value={hrSearchTerm}
                                        onChange={(e) => setHrSearchTerm(e.target.value)}
                                        className="w-full bg-white"
                                    />
                                </div>
                            </div>

                            {/* Result Table */}
                            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                                {/* Header Row */}
                                <div className="grid grid-cols-12 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                                    <div className="col-span-4">Employee Name</div>
                                    <div className="col-span-2">Date</div>
                                    <div className="col-span-2">Department</div>
                                    <div className="col-span-2">Work Loc.</div>
                                    <div className="col-span-2 text-center">Status</div>
                                </div>

                                {/* Rows */}
                                <div className="divide-y text-sm">
                                    {hrSearchResults.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            No records found for the selected criteria.
                                        </div>
                                    ) : (
                                        hrSearchResults.map((record) => (
                                            <div
                                                key={record.id}
                                                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="col-span-4 font-medium text-foreground">
                                                    {record.employeeName}
                                                </div>
                                                <div className="col-span-2 text-muted-foreground">
                                                    {record.date}
                                                </div>
                                                <div className="col-span-2 text-muted-foreground">
                                                    {record.department}
                                                </div>
                                                <div className="col-span-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        {record.workLocation}
                                                    </Badge>
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <Badge className={cn(
                                                        "text-xs font-semibold",
                                                        record.status === "Present"
                                                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                                                            : record.status === "Absent"
                                                                ? "bg-red-100 text-red-700 hover:bg-red-100"
                                                                : "bg-gray-100 text-gray-700"
                                                    )}>
                                                        {record.status || "—"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- Tab 4: Bulk Attendance --- */}
                <TabsContent value="bulk-attendance" className="space-y-4">
                    <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg">Bulk Attendance</CardTitle>
                                    <CardDescription>Manage daily attendance for multiple employees</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="Search employee..."
                                        value={bulkSearchTerm}
                                        onChange={(e) => setBulkSearchTerm(e.target.value)}
                                        className="w-[200px] h-9 bg-white"
                                    />
                                    <div className="w-[240px]">
                                        <DatePicker
                                            date={bulkDate}
                                            setDate={(d) => d && setBulkDate(d)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="bg-card border rounded-lg overflow-hidden shadow-sm mx-6 mb-6">
                                {/* Header Row */}
                                <div className="grid grid-cols-12 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                                    <div className="col-span-8">Employee Name</div>
                                    <div className="col-span-4 text-right pr-6">Mark Present</div>
                                </div>

                                {/* Rows */}
                                <div className="divide-y text-sm">
                                    {BULK_EMPLOYEES
                                        .filter(record =>
                                            record.employeeName.toLowerCase().includes(bulkSearchTerm.toLowerCase())
                                        )
                                        .map((record) => {
                                            const dateStr = format(bulkDate, "yyyy-MM-dd");
                                            const status = bulkAttendanceMap[dateStr]?.[record.id] || null;

                                            return (
                                                <div
                                                    key={record.id}
                                                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors group"
                                                >
                                                    <div className="col-span-8 font-medium text-foreground">
                                                        {record.employeeName}
                                                    </div>
                                                    <div className="col-span-4 text-right flex justify-end pr-8">
                                                        <Checkbox
                                                            checked={status === "Present"}
                                                            onCheckedChange={(checked) =>
                                                                handleBulkSetStatus(record.id, checked ? "Present" : "Absent")
                                                            }
                                                            className="h-5 w-5 border-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>

                                {/* Save Button */}
                                <div className="flex justify-end p-6 border-t bg-muted/10">
                                    <Button
                                        onClick={() => {
                                            toast({
                                                title: "Bulk Attendance Saved",
                                                description: "All employee attendance records for " + format(bulkDate, "PPP") + " have been updated successfully.",
                                            });
                                            const dateStr = format(bulkDate, "yyyy-MM-dd");
                                            console.log("Saving Bulk Attendance Data for " + dateStr + ":", bulkAttendanceMap[dateStr]);
                                        }}
                                        disabled={!Object.values(bulkAttendanceMap[format(bulkDate, "yyyy-MM-dd")] || {}).some(status => status === "Present")}
                                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save className="h-4 w-4" />
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

        </div>
    );
}

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
        // Use minDate if provided, BUT DON'T default to today if not provided
        // This allows selecting past dates when minDate is undefined
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);

        let isBeforeMinDate = false;
        if (minDate) {
            const minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
            isBeforeMinDate = selected < minimumDate;
        }

        // Check if date is blocked
        const isBlocked = blockedDates?.some(blockedDate => {
            const blocked = new Date(blockedDate);
            blocked.setHours(0, 0, 0, 0);
            return blocked.getTime() === selected.getTime();
        });

        // Only allow dates >= minimumDate (if set) and not blocked
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

        // Use minDate if provided, BUT DON'T default to today if not provided
        let minimumDate: Date | null = null;
        if (minDate) {
            minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
        }

        // Previous month's trailing days
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

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            const isPast = minimumDate ? currentDate < minimumDate : false;

            // Check if date is blocked
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
                isPast: isPast || isBlocked // Treat blocked dates as past dates for styling
            });
        }

        // Next month's leading days
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
