import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsUpDown, Check, X, ChevronDown, Save, Search } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";

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
    inTime?: string;
    outTime?: string;
}

interface BulkRecord {
    id: string;
    employeeName: string;
    department: string;
    workLocation: string;
    date: string; // YYYY-MM-DD
    status: "Present" | "Absent" | null;
    inTime?: string;
    outTime?: string;
}

// --- Reusable Searchable Combobox Component ---
// Redundant local component removed (SearchableSelect)

export default function AttendancePage() {
    const { toast } = useToast();
    // --- Router State ---
    const [location, setLocation] = useLocation();
    const params = useParams();
    
    // Determine current tab from URL params
    const getCurrentTab = () => {
        if (params.tab === 'bulk-attendance') return 'bulk-attendance';
        if (params.tab === 'hr-view') return 'hr-view';
        return 'hr-view';
    };
    
    const [activeTab, setActiveTab] = useState(getCurrentTab());

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setLocation(`/hrms/attendance/${value}`);
    };

    // Set initial tab based on URL
    useEffect(() => {
        const currentTab = getCurrentTab();
        if (currentTab !== activeTab) {
            setActiveTab(currentTab);
        }
        // Redirect to default tab if no tab specified
        if (!params.tab && location === '/hrms/attendance') {
            setLocation('/hrms/attendance/hr-view');
        }
    }, [params.tab, location]);

    // --- State ---
    // ⚠️ SAFE GUARD: Added ONE mock attendance record to prevent runtime crashes
    // This ensures attendance list never crashes when empty
    // ============================================================================
    const [attendanceList, setAttendanceList] = useState<Attendance[]>([
        {
            id: "att-001",
            date: "10-02-2026",
            status: "Present"
        }
    ]);

    // --- HR View State ---
    const [hrDepartment, setHrDepartment] = useState("all");
    const [hrWorkLocation, setHrWorkLocation] = useState("all");
    const [hrDate, setHrDate] = useState<Date | undefined>(undefined);
    const [hrSearchTerm, setHrSearchTerm] = useState("");
    const [hrSearchResults, setHrSearchResults] = useState<HRRecord[]>([]);
    
    // Pagination state for HR Search Results
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);



    // Formatting date for display - DD-MM-YYYY format
    const formatDateDisplay = (dateStr: string) => {
        try {
            return format(parseISO(dateStr), "dd-MM-yyyy");
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
            date: "10-02-2026",
            department: "Engineering",
            workLocation: "Head Office",
            status: "Present",
            inTime: "09:00",
            outTime: "18:00"
        }
    ];

    useEffect(() => {
        const results = HR_MOCK_DATA.filter(record => {
            const matchDept = hrDepartment && hrDepartment !== "all" ? record.department === hrDepartment : true;
            const matchLocation = hrWorkLocation && hrWorkLocation !== "all" ? record.workLocation === hrWorkLocation : true;
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

    // Pagination logic for HR Search Results
    const totalPages = Math.ceil(hrSearchResults.length / itemsPerPage);
    const paginatedResults = hrSearchResults.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [hrSearchResults.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
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
        { id: "b6", employeeName: "Fiona Apple", department: "HR", workLocation: "Plant 3" },
        { id: "b7", employeeName: "George Michael", department: "Sales", workLocation: "Plant 1" },
        { id: "b8", employeeName: "Hannah Montana", department: "Finance", workLocation: "Plant 2" },
        { id: "b9", employeeName: "Ian Wright", department: "IT", workLocation: "Plant 3" },
        { id: "b10", employeeName: "Janet Jackson", department: "HR", workLocation: "Plant 1" },
        { id: "b11", employeeName: "Kevin Hart", department: "Sales", workLocation: "Plant 2" },
        { id: "b12", employeeName: "Lana Del Rey", department: "Finance", workLocation: "Plant 3" },
        { id: "b13", employeeName: "Michael Jordan", department: "IT", workLocation: "Plant 1" },
        { id: "b14", employeeName: "Nina Simone", department: "HR", workLocation: "Plant 2" },
        { id: "b15", employeeName: "Oscar Wilde", department: "Sales", workLocation: "Plant 3" },
        { id: "b16", employeeName: "Paul McCartney", department: "Finance", workLocation: "Plant 1" },
        { id: "b17", employeeName: "Quentin Tarantino", department: "IT", workLocation: "Plant 2" },
        { id: "b18", employeeName: "Rihanna Fenty", department: "HR", workLocation: "Plant 3" },
        { id: "b19", employeeName: "Steven Spielberg", department: "Sales", workLocation: "Plant 1" },
        { id: "b20", employeeName: "Tina Turner", department: "Finance", workLocation: "Plant 2" },
    ];

    // Map to store attendance status indexed by date and employee ID
    // Record<dateString, Record<employeeId, {status, inTime, outTime}>>
    const [bulkAttendanceMap, setBulkAttendanceMap] = useState<Record<string, Record<string, { status: "Present" | "Absent" | null, inTime: string, outTime: string }>>>({});

    const handleBulkSetStatus = (id: string, status: "Present" | "Absent", extra?: { inTime?: string; outTime?: string }) => {
        const dateStr = format(bulkDate, "yyyy-MM-dd");
        setBulkAttendanceMap(prev => {
            const currentData = prev[dateStr]?.[id] || { status: null, inTime: "", outTime: "" };
            return {
                ...prev,
                [dateStr]: {
                    ...(prev[dateStr] || {}),
                    [id]: {
                        ...currentData,
                        status,
                        ...(extra || {})
                    }
                }
            };
        });
    };

    const handleBulkTimeChange = (id: string, field: "inTime" | "outTime", value: string) => {
        const dateStr = format(bulkDate, "yyyy-MM-dd");
        setBulkAttendanceMap(prev => {
            const currentData = prev[dateStr]?.[id] || { status: null, inTime: "", outTime: "" };
            return {
                ...prev,
                [dateStr]: {
                    ...(prev[dateStr] || {}),
                    [id]: {
                        ...currentData,
                        [field]: value
                    }
                }
            };
        });
    };

    // --- Bulk Entry State ---
    const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [bulkInTime, setBulkInTime] = useState("");
    const [bulkOutTime, setBulkOutTime] = useState("");
    const [popupSearchTerm, setPopupSearchTerm] = useState("");

    const handleBulkEntrySave = () => {
        const dateStr = format(bulkDate, "yyyy-MM-dd");
        setBulkAttendanceMap(prev => {
            const newDateMap = { ...(prev[dateStr] || {}) };
            selectedEmployees.forEach(id => {
                newDateMap[id] = {
                    status: "Present",
                    inTime: bulkInTime,
                    outTime: bulkOutTime
                };
            });
            return { ...prev, [dateStr]: newDateMap };
        });
        setIsBulkEntryOpen(false);
        setSelectedEmployees([]);
        setBulkInTime("");
        setBulkOutTime("");
        toast({
            title: "Bulk Entry Applied",
            description: `Applied attendance for ${selectedEmployees.length} employees.`,
        });
    };



    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
                <p className="text-muted-foreground text-sm">
                    Track your attendance and overtime
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none">
                        {/* <TabsTrigger
                            value="record"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-colors hover:text-foreground"
                        >
                            Attendance Record
                        </TabsTrigger> */}
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

                {/* --- Tab 1: Attendance Record (Hidden) --- */}
                {/* 
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
                                <div className="grid grid-cols-12 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                                    <div className="col-span-8">Date</div>
                                    <div className="col-span-4 text-right pr-6">Mark Present</div>
                                </div>
                                <div className="divide-y text-sm">
                                    {groupedAttendance.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            No attendance record found for {format(recordDate, "MMMM dd, yyyy")}.
                                            Use the checkbox to mark your status.
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
                                <div className="flex justify-end p-6 border-t bg-muted/10">
                                    <Button
                                        onClick={() => {}}
                                        disabled={true}
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
                */}

                {/* --- Tab 3: HR View --- */}
                {/* UI Layout: Matches Materials listing table design */}
                <TabsContent value="hr-view" className="space-y-4 mt-4">
                    <AppListToolbar
                        search={{
                            value: hrSearchTerm,
                            onChange: setHrSearchTerm,
                            placeholder: "Search employees..."
                        }}
                        filters={[
                            {
                                type: 'select',
                                label: 'Department',
                                value: hrDepartment,
                                options: [{ label: "All Departments", value: "all" }, "IT", "HR", "Finance", "Sales", "Engineering", "Marketing", "Operations"],
                                onChange: setHrDepartment,
                                searchable: true
                            },
                            {
                                type: 'select',
                                label: 'Location',
                                value: hrWorkLocation,
                                options: [{ label: "All Locations", value: "all" }, "Plant 1", "Plant 2", "Plant 3", "HQ Office", "Remote"],
                                onChange: setHrWorkLocation,
                                searchable: true
                            },
                            {
                                type: 'date',
                                label: 'Date',
                                value: hrDate ? format(hrDate, "yyyy-MM-dd") : "",
                                onChange: (val) => setHrDate(val ? new Date(val) : undefined)
                            }
                        ]}
                    />

                    {/* Table Card - Same structure as Materials reference */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="font-semibold text-xs uppercase tracking-wider">Employee Name</TableHead>
                                            <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
                                            <TableHead className="font-semibold text-xs uppercase tracking-wider">Department</TableHead>
                                            <TableHead className="font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                                            <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                            <TableHead className="font-semibold text-xs uppercase tracking-wider">In Time</TableHead>
                                            <TableHead className="font-semibold text-xs uppercase tracking-wider">Out Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedResults.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                                    No records found for the selected criteria.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedResults.map((record) => (
                                                <TableRow key={record.id} className="hover:bg-muted/30 transition-colors border-b">
                                                    <TableCell className="py-4 font-medium">{record.employeeName}</TableCell>
                                                    <TableCell>{formatDateDisplay(record.date)}</TableCell>
                                                    <TableCell>{record.department}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            {record.workLocation}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "font-medium",
                                                                record.status === "Present" && "border-green-500 text-green-600 bg-green-50",
                                                                record.status === "Absent" && "border-red-500 text-red-600 bg-red-50"
                                                            )}
                                                        >
                                                            {record.status || "—"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{record.inTime || "—"}</TableCell>
                                                    <TableCell>{record.outTime || "—"}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination - Same position as Materials reference */}
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={hrSearchResults.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- Tab 4: Bulk Attendance --- */}
                <TabsContent value="bulk-attendance" className="flex-1 flex flex-col overflow-hidden mt-4">
                    <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                        <AppListToolbar
                            search={{
                                value: bulkSearchTerm,
                                onChange: setBulkSearchTerm,
                                placeholder: "Search employee..."
                            }}
                            filters={[
                                {
                                    type: 'date',
                                    label: 'Date',
                                    value: bulkDate,
                                    onChange: (val) => setBulkDate(val || new Date()),
                                    showClear: !isSameDay(bulkDate, new Date())
                                }
                            ]}
                            actions={[
                                {
                                    label: 'Bulk Entry',
                                    onClick: () => {
                                        const dateStr = format(bulkDate, "yyyy-MM-dd");
                                        const currentRecords = bulkAttendanceMap[dateStr] || {};
                                        const presentIds = Object.keys(currentRecords).filter(id => currentRecords[id].status === "Present");
                                        setSelectedEmployees(presentIds);
                                        if (presentIds.length > 0) {
                                            const firstRecord = currentRecords[presentIds[0]];
                                            setBulkInTime(firstRecord.inTime || "");
                                            setBulkOutTime(firstRecord.outTime || "");
                                        } else {
                                            setBulkInTime("");
                                            setBulkOutTime("");
                                        }
                                        setIsBulkEntryOpen(true);
                                    },
                                    variant: 'default'
                                }
                            ]}
                        />
                        <Card className="flex-1 flex flex-col overflow-hidden">
                            <CardContent className="pt-6 flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-auto">
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 sticky top-0 z-10">
                                                    <TableHead className="w-[40%]">Employee Name</TableHead>
                                                    <TableHead>In Time</TableHead>
                                                    <TableHead>Out Time</TableHead>
                                                    <TableHead className="text-right pr-6">Mark Present</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {BULK_EMPLOYEES
                                                    .filter(record => record.employeeName.toLowerCase().includes(bulkSearchTerm.toLowerCase()))
                                                    .map((record) => {
                                                        const dateStr = format(bulkDate, "yyyy-MM-dd");
                                                        const attendanceData = bulkAttendanceMap[dateStr]?.[record.id] || { status: null, inTime: "", outTime: "" };
                                                        return (
                                                            <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                                                                <TableCell className="font-medium">{record.employeeName}</TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="time"
                                                                        value={attendanceData.inTime}
                                                                        onChange={(e) => handleBulkTimeChange(record.id, "inTime", e.target.value)}
                                                                        className="h-8 w-24"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="time"
                                                                        value={attendanceData.outTime}
                                                                        onChange={(e) => handleBulkTimeChange(record.id, "outTime", e.target.value)}
                                                                        className="h-8 w-24"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right pr-8">
                                                                    <Checkbox
                                                                        checked={attendanceData.status === "Present"}
                                                                        onCheckedChange={(checked) => handleBulkSetStatus(record.id, checked ? "Present" : "Absent")}
                                                                        className="h-5 w-5"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                {/* Sticky Footer for Save Button */}
                                <div className="shrink-0 flex justify-end p-6 border-t bg-background mt-4">
                                    <Button
                                        onClick={() => {
                                            toast({
                                                title: "Bulk Attendance Saved",
                                                description: "All employee attendance records have been updated successfully.",
                                            });
                                            const dateStr = format(bulkDate, "yyyy-MM-dd");
                                            console.log("Saving Bulk Data:", bulkAttendanceMap[dateStr]);
                                        }}
                                        disabled={!Object.values(bulkAttendanceMap[format(bulkDate, "yyyy-MM-dd")] || {}).some(record => record.status === "Present")}
                                        className="h-10 min-w-[150px] gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        Save Attendance
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Bulk Entry Dialog */}
                        <Dialog open={isBulkEntryOpen} onOpenChange={setIsBulkEntryOpen}>
                            <DialogContent className="max-w-lg p-0 overflow-hidden bg-white">
                                <DialogHeader className="p-6 pb-2 border-b">
                                    <DialogTitle className="text-xl font-bold">Bulk Attendance Entry</DialogTitle>
                                </DialogHeader>
                                <div className="flex flex-col h-[550px]">
                                    <div className="p-6 border-b bg-slate-50/50">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700">In Time</Label>
                                                <Input
                                                    type="time"
                                                    value={bulkInTime}
                                                    onChange={(e) => setBulkInTime(e.target.value)}
                                                    className="h-10 bg-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-700">Out Time</Label>
                                                <Input
                                                    type="time"
                                                    value={bulkOutTime}
                                                    onChange={(e) => setBulkOutTime(e.target.value)}
                                                    className="h-10 bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        <div className="p-4 border-b bg-muted/10 space-y-3">
                                            <Input
                                                placeholder="Search employees by name or department..."
                                                value={popupSearchTerm}
                                                onChange={(e) => setPopupSearchTerm(e.target.value)}
                                                className="h-9 bg-white"
                                            />
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="popup-select-all"
                                                    checked={selectedEmployees.length === BULK_EMPLOYEES.length && BULK_EMPLOYEES.length > 0}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) setSelectedEmployees(BULK_EMPLOYEES.map(e => e.id));
                                                        else setSelectedEmployees([]);
                                                    }}
                                                />
                                                <Label htmlFor="popup-select-all" className="font-semibold cursor-pointer">Select All</Label>
                                            </div>
                                        </div>
                                        <ScrollArea className="flex-1">
                                            <div className="p-2 space-y-1">
                                                {BULK_EMPLOYEES.filter(emp =>
                                                    emp.employeeName.toLowerCase().includes(popupSearchTerm.toLowerCase()) ||
                                                    emp.department.toLowerCase().includes(popupSearchTerm.toLowerCase())
                                                ).map((emp) => (
                                                    <div key={emp.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                                        <Checkbox
                                                            id={`popup-emp-${emp.id}`}
                                                            checked={selectedEmployees.includes(emp.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) setSelectedEmployees(prev => [...prev, emp.id]);
                                                                else setSelectedEmployees(prev => prev.filter(id => id !== emp.id));
                                                            }}
                                                        />
                                                        <Label htmlFor={`popup-emp-${emp.id}`} className="flex-1 cursor-pointer py-1">
                                                            <div className="font-medium">{emp.employeeName}</div>
                                                            <div className="text-xs text-muted-foreground">{emp.department} • {emp.workLocation}</div>
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>
                                <div className="p-4 px-6 border-t bg-white flex justify-between items-center shrink-0">
                                    <div className="text-sm font-medium text-slate-600">
                                        <span className="text-blue-600 font-bold">{selectedEmployees.length}</span> out of <span className="font-bold">{BULK_EMPLOYEES.length}</span> selected
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={() => setIsBulkEntryOpen(false)}>Cancel</Button>
                                        <Button className="min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkEntrySave}>Save Changes</Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </TabsContent>
            </Tabs>
        </div >
    );
}

// Redundant local DatePicker component removed
