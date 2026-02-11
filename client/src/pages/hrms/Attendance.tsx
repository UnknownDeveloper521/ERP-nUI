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
import { Calendar as CalendarIcon, LogIn, LogOut, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInMinutes, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval, isSameDay, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface Attendance {
    id: string;
    date: string; // YYYY-MM-DD
    checkIn: string | null; // ISO String
    checkOut: string | null; // ISO String
    workHours: string; // HH:mm
}

interface DayAttendance {
    date: string;
    sessions: {
        checkIn: string;
        checkOut: string;
        workHours: string;   // per session
    }[];
    checkIn?: string;
    checkOut?: string;
    workHours?: string;
    finalCheckout: string;
    firstCheckIn: string;
    totalWorkHours: string; // sum of sessions
    employeeName?: string;
    department?: string;
    workLocation?: string;
}

interface Overtime {
    id: string; // same as attendance id
    date: string;
    workHours: string;
    extraHours: string;
}

interface HRRecord {
    id: string;
    employeeName: string;
    date: string;
    department: string;
    workLocation: string;
    punches: {
        checkIn: string; // HH:mm
        checkOut: string; // HH:mm
    }[];
    workHours: string; // Calculated total
    extraHours?: string;
}

interface BulkRecord {
    id: string;
    employeeName: string;
    department: string;
    workLocation: string;
    date: string; // YYYY-MM-DD
    sessions: {
        checkIn: string; // ISO
        checkOut: string | null; // ISO
    }[];
    checkIn: string;
    checkOut: string | null;
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
            checkIn: new Date("2026-02-10T09:00:00").toISOString(),
            checkOut: new Date("2026-02-10T18:00:00").toISOString(),
            workHours: "09:00"
        }
    ]);
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [currentCheckInTime, setCurrentCheckInTime] = useState<string | null>(null);
    const [lastCheckOutTime, setLastCheckOutTime] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [currentOvertimePage, setCurrentOvertimePage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Modal state
    const [selectedDay, setSelectedDay] = useState<DayAttendance | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // --- HR View State ---
    const [hrDepartment, setHrDepartment] = useState("All Departments");
    const [hrWorkLocation, setHrWorkLocation] = useState("All Locations");
    const [hrDate, setHrDate] = useState("");
    const [hrSearchTerm, setHrSearchTerm] = useState("");
    const [hrSearchResults, setHrSearchResults] = useState<HRRecord[]>([]);

    // Constants
    const STANDARD_HOURS_MINUTES = 8 * 60; // 8 hours in minutes

    // --- Helpers ---

    // Format minutes to HH:mm
    const formatMinutesToHHMM = (totalMinutes: number): string => {
        if (totalMinutes <= 0) return "00:00";
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    // Calculate work hours between two ISO strings
    const calculateWorkHours = (start: string, end: string): string => {
        try {
            const startDate = parseISO(start);
            const endDate = parseISO(end);
            startDate.setSeconds(0, 0);
            endDate.setSeconds(0, 0);

            const diff = differenceInMinutes(endDate, startDate);
            return formatMinutesToHHMM(diff);
        } catch (e) {
            console.error("Date calculation error", e);
            return "00:00";
        }
    };

    // Calculate Extra Hours for Overtime
    const calculateExtraHours = (workHoursStr: string): string => {
        const [hours, mins] = workHoursStr.split(':').map(Number);
        const totalMinutes = hours * 60 + mins;

        if (totalMinutes > STANDARD_HOURS_MINUTES) {
            return formatMinutesToHHMM(totalMinutes - STANDARD_HOURS_MINUTES);
        }
        return "00:00";
    };

    // Formatting time for display (e.g., "09:02")
    const formatTimeDisplay = (isoString: string | null) => {
        if (!isoString) return "—";
        try {
            return format(parseISO(isoString), "HH:mm");
        } catch {
            return "—";
        }
    };

    // Formatting date for display
    const formatDateDisplay = (dateStr: string) => {
        try {
            return format(parseISO(dateStr), "MMMM dd, yyyy");
        } catch {
            return dateStr;
        }
    };

    // --- Constants ---
    const MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const CURRENT_YEAR = new Date().getFullYear();
    const YEARS = Array.from({ length: 5 }, (_, i) => (CURRENT_YEAR - 2 + i).toString()); // e.g., 2024-2028 if current is 2026

    // Filter state
    const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[new Date().getMonth()]);
    const [selectedYear, setSelectedYear] = useState<string>(CURRENT_YEAR.toString());

    // Group attendance list by day
    const getGroupedAttendance = (): DayAttendance[] => {
        const groups: { [key: string]: Attendance[] } = {};

        // Calculate start and end of selected month/year
        const monthIndex = MONTHS.indexOf(selectedMonth);
        const year = parseInt(selectedYear);
        const start = new Date(year, monthIndex, 1);
        const end = endOfMonth(start);

        const interval = { start, end };

        attendanceList.forEach(record => {
            const recordDate = parseISO(record.date);
            if (isWithinInterval(recordDate, interval)) {
                if (!groups[record.date]) {
                    groups[record.date] = [];
                }
                groups[record.date].push(record);
            }
        });

        // Convert groups to DayAttendance array
        const dayRecords: DayAttendance[] = Object.keys(groups).map(date => {
            const sessions = groups[date].map(s => ({
                checkIn: formatTimeDisplay(s.checkIn),
                checkOut: formatTimeDisplay(s.checkOut),
                workHours: s.workHours
            }));

            // Calculate total work hours for the day
            let totalMinutes = 0;
            groups[date].forEach(s => {
                const [h, m] = s.workHours.split(':').map(Number);
                totalMinutes += (h * 60) + m;
            });
            const totalWorkHours = formatMinutesToHHMM(totalMinutes);

            // Find final checkout
            // Sort sessions by checkout time to find the last one
            const completedSessions = groups[date].filter(s => s.checkOut !== null);
            let finalCheckout = "—";
            if (completedSessions.length > 0) {
                // Sort by checkOut time desc
                completedSessions.sort((a, b) => {
                    return new Date(b.checkOut!).getTime() - new Date(a.checkOut!).getTime();
                });
                finalCheckout = formatTimeDisplay(completedSessions[0].checkOut);
            }

            // Find first check in
            // Sort by checkIn time asc
            const sortedByCheckIn = [...groups[date]].sort((a, b) => {
                const timeA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
                const timeB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
                return timeA - timeB;
            });
            const firstCheckIn = formatTimeDisplay(sortedByCheckIn[0]?.checkIn);


            return {
                date,
                sessions,
                finalCheckout,
                firstCheckIn,
                totalWorkHours
            };
        });

        // Sort by date descending
        return dayRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const groupedAttendance = getGroupedAttendance();

    // --- Handlers ---

    const handleCheckIn = () => {
        const now = new Date();
        const todayStr = format(now, "yyyy-MM-dd");
        const nowIso = now.toISOString();

        const newRecord: Attendance = {
            id: crypto.randomUUID(),
            date: todayStr,
            checkIn: nowIso,
            checkOut: null,
            workHours: "00:00",
        };

        setAttendanceList((prev) => [newRecord, ...prev]);
        setIsCheckedIn(true);
        setCurrentCheckInTime(nowIso);
    };

    const handleCheckOut = () => {
        if (!currentCheckInTime) return;

        const now = new Date();
        const nowIso = now.toISOString();

        setAttendanceList((prev) => {
            // Find the active session (checkOut is null)
            const activeIndex = prev.findIndex(r => r.checkOut === null);
            if (activeIndex === -1) return prev;

            const activeRecord = prev[activeIndex];
            const workHours = calculateWorkHours(activeRecord.checkIn!, nowIso);

            const updatedRecord = {
                ...activeRecord,
                checkOut: nowIso,
                workHours: workHours,
            };

            const newList = [...prev];
            newList[activeIndex] = updatedRecord;
            return newList;
        });

        setIsCheckedIn(false);
        setCurrentCheckInTime(null);
        setLastCheckOutTime(nowIso);
    };

    // Update lastCheckOutTime when attendanceList changes (e.g. initial load or updates)
    useEffect(() => {
        const completed = attendanceList.filter(a => a.checkOut !== null);
        if (completed.length > 0) {
            // Sort to find likely latest
            completed.sort((a, b) => new Date(b.checkOut!).getTime() - new Date(a.checkOut!).getTime());
            setLastCheckOutTime(completed[0].checkOut);
        } else {
            setLastCheckOutTime(null);
        }

        // Sync isCheckedIn state
        const active = attendanceList.find(a => a.checkOut === null);
        if (active) {
            setIsCheckedIn(true);
            setCurrentCheckInTime(active.checkIn);
        } else {
            setIsCheckedIn(false);
            setCurrentCheckInTime(null);
        }
    }, [attendanceList]);


    const getOvertimeData = (): Overtime[] => {
        // Overtime is calculated per day based on total hours
        return groupedAttendance.map(record => ({
            id: record.date + "-ot", // unique-ish id
            date: record.date,
            workHours: record.totalWorkHours,
            extraHours: calculateExtraHours(record.totalWorkHours)
        }));
    };

    // --- Pagination Logic (Day Grouped) ---
    const totalPages = Math.ceil(groupedAttendance.length / ITEMS_PER_PAGE);
    const paginatedAttendance = groupedAttendance.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    // --- Overtime Pagination Logic ---
    const overtimeData = getOvertimeData();
    const totalOvertimePages = Math.ceil(overtimeData.length / ITEMS_PER_PAGE);
    const paginatedOvertime = overtimeData.slice(
        (currentOvertimePage - 1) * ITEMS_PER_PAGE,
        currentOvertimePage * ITEMS_PER_PAGE
    );

    const handleOvertimeNextPage = () => {
        if (currentOvertimePage < totalOvertimePages) setCurrentOvertimePage(prev => prev + 1);
    };

    const handleOvertimePrevPage = () => {
        if (currentOvertimePage > 1) setCurrentOvertimePage(prev => prev - 1);
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
            punches: [
                { checkIn: "09:00", checkOut: "18:00" }
            ],
            workHours: "09:00"
        }
    ];

    const calculateTotalWorkHoursHR = (punches: { checkIn: string; checkOut: string }[]): string => {
        let totalMinutes = 0;
        punches.forEach(punch => {
            if (!punch.checkIn || !punch.checkOut) return;
            const [inH, inM] = punch.checkIn.split(':').map(Number);
            const [outH, outM] = punch.checkOut.split(':').map(Number);
            const startMins = inH * 60 + inM;
            const endMins = outH * 60 + outM;
            if (endMins > startMins) totalMinutes += (endMins - startMins);
        });
        return formatMinutesToHHMM(totalMinutes);
    };

    useEffect(() => {
        const calculatedData = HR_MOCK_DATA.map(record => {
            const totalWorkHours = calculateTotalWorkHoursHR(record.punches);
            return {
                ...record,
                workHours: totalWorkHours,
                extraHours: calculateExtraHours(totalWorkHours)
            };
        });

        const results = calculatedData.filter(record => {
            const matchDept = hrDepartment && hrDepartment !== "All Departments" ? record.department === hrDepartment : true;
            const matchLocation = hrWorkLocation && hrWorkLocation !== "All Locations" ? record.workLocation === hrWorkLocation : true;
            const matchDate = hrDate ? record.date === hrDate : true;
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
    // ⚠️ SAFE GUARD: Added ONE mock bulk attendance record to prevent runtime crashes
    // This ensures bulk attendance view never crashes when empty
    // ============================================================================
    const [bulkAttendanceData, setBulkAttendanceData] = useState<BulkRecord[]>([
        { id: "b1", employeeName: "Alice Johnson", date: format(new Date(), "yyyy-MM-dd"), sessions: [], department: "IT", workLocation: "Plant 1", checkIn: "—", checkOut: null },
        { id: "b2", employeeName: "Bob Smith", date: format(new Date(), "yyyy-MM-dd"), sessions: [], department: "HR", workLocation: "Plant 2", checkIn: "—", checkOut: null },
        { id: "b3", employeeName: "Charlie Brown", date: format(new Date(), "yyyy-MM-dd"), sessions: [], department: "Sales", workLocation: "Plant 3", checkIn: "—", checkOut: null },
        { id: "b4", employeeName: "Diana Ross", date: format(new Date(), "yyyy-MM-dd"), sessions: [], department: "Finance", workLocation: "Plant 1", checkIn: "—", checkOut: null },
        { id: "b5", employeeName: "Ethan Hunt", date: format(new Date(), "yyyy-MM-dd"), sessions: [], department: "IT", workLocation: "Plant 2", checkIn: "—", checkOut: null },
    ]);
    const [bulkSearchTerm, setBulkSearchTerm] = useState("");
    const [isBulkDatePickerOpen, setIsBulkDatePickerOpen] = useState(false);

    // Update mock dates when bulkDate changes
    useEffect(() => {
        const dateStr = format(bulkDate, "yyyy-MM-dd");
        setBulkAttendanceData(prev => prev.map(r => ({ ...r, date: dateStr })));
    }, [bulkDate]);

    const handleBulkCheckIn = (id: string) => {
        const nowIso = new Date().toISOString();
        setBulkAttendanceData(prev => prev.map(r =>
            r.id === id ? { ...r, sessions: [...r.sessions, { checkIn: nowIso, checkOut: null }] } : r
        ));
    };

    const handleBulkCheckOut = (id: string) => {
        const nowIso = new Date().toISOString();
        setBulkAttendanceData(prev => prev.map(r => {
            if (r.id === id) {
                const newSessions = [...r.sessions];
                const activeIndex = newSessions.findIndex(s => s.checkOut === null);
                if (activeIndex !== -1) {
                    newSessions[activeIndex] = { ...newSessions[activeIndex], checkOut: nowIso };
                    return { ...r, sessions: newSessions };
                }
            }
            return r;
        }));
    };

    const handleBulkRowClick = (record: BulkRecord) => {
        // Calculate total work hours
        let totalMinutes = 0;
        const sessions = record.sessions.map(s => {
            if (s.checkIn && s.checkOut) {
                const diff = differenceInMinutes(parseISO(s.checkOut), parseISO(s.checkIn));
                totalMinutes += diff;
                return {
                    checkIn: formatTimeDisplay(s.checkIn),
                    checkOut: formatTimeDisplay(s.checkOut),
                    workHours: formatMinutesToHHMM(diff)
                };
            } else {
                return {
                    checkIn: formatTimeDisplay(s.checkIn),
                    checkOut: "Active",
                    workHours: "—"
                };
            }
        });

        // Find first check in and last check out
        const firstCheckIn = record.sessions.length > 0 ? formatTimeDisplay(record.sessions[0].checkIn) : "—";
        const lastSession = record.sessions[record.sessions.length - 1];
        const finalCheckout = lastSession?.checkOut ? formatTimeDisplay(lastSession.checkOut) : "—";


        const adpatedRecord: DayAttendance = {
            date: record.date,
            sessions: sessions,
            finalCheckout,
            firstCheckIn,
            totalWorkHours: formatMinutesToHHMM(totalMinutes),
            employeeName: record.employeeName,
            department: record.department,
            workLocation: record.workLocation
        };
        setSelectedDay(adpatedRecord);
        setIsDialogOpen(true);
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
                            value="overtime"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-colors hover:text-foreground"
                        >
                            Overtime
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
                    {/* Controls Bar */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 px-1">
                        <div className="flex items-center gap-4">
                            <div className="flex gap-2">
                                <div className="w-[140px]">
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONTHS.map(month => (
                                                <SelectItem key={month} value={month}>{month}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-[100px]">
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {YEARS.map(year => (
                                                <SelectItem key={year} value={year}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <Button
                                onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                                className={cn(
                                    "min-w-[140px]",
                                    isCheckedIn
                                        ? "bg-red-500 hover:bg-red-600 text-white"
                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                )}
                            >
                                {isCheckedIn ? (
                                    <>
                                        <LogOut className="mr-2 h-4 w-4" /> Check Out
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="mr-2 h-4 w-4" /> Check In
                                    </>
                                )}
                            </Button>

                            {/* Status Text Below Button */}
                            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                {isCheckedIn ? (
                                    <>
                                        <span>Check In Time:</span>
                                        <span className="text-foreground">{formatTimeDisplay(currentCheckInTime)}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Last Check Out Time:</span>
                                        <span className="text-foreground">{formatTimeDisplay(lastCheckOutTime)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Table-like Card Layout */}
                    <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                        {/* Header Row */}
                        <div className="grid grid-cols-12 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                            <div className="col-span-3">Date</div>
                            <div className="col-span-3">Check In Time</div>
                            <div className="col-span-3">Check Out Time</div>
                            <div className="col-span-3">Work Hours</div>
                        </div>

                        {/* Rows */}
                        <div className="divide-y text-sm">
                            {groupedAttendance.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    No attendance records found. Click "Check In" to start.
                                </div>
                            ) : (
                                paginatedAttendance.map((record, index) => (
                                    <div
                                        key={record.date + index}
                                        className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors group"
                                    >
                                        <div className="col-span-3 flex items-center gap-3">
                                            <button
                                                onClick={() => {
                                                    setSelectedDay(record);
                                                    setIsDialogOpen(true);
                                                }}
                                                className="font-medium text-primary hover:underline hover:text-blue-700 text-left focus:outline-none"
                                            >
                                                {formatDateDisplay(record.date)}
                                            </button>
                                        </div>
                                        <div className="col-span-3 text-muted-foreground">
                                            {record.firstCheckIn}
                                        </div>
                                        <div className="col-span-3 text-muted-foreground">
                                            {record.finalCheckout}
                                        </div>
                                        <div className="col-span-3">
                                            <Badge variant="outline" className={cn(
                                                "font-mono font-medium",
                                                record.totalWorkHours === "00:00" ? "text-slate-400 border-slate-200" : "text-slate-700 border-slate-300"
                                            )}>
                                                {record.totalWorkHours}
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Pagination */}
                        <div className="flex items-center justify-between py-4 px-4 border-t">
                            <span className="text-sm text-muted-foreground">
                                Showing {groupedAttendance.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, groupedAttendance.length)} of {groupedAttendance.length} records
                            </span>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* --- Tab 2: Overtime --- */}
                <TabsContent value="overtime" className="space-y-4">
                    <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            {/* <CardTitle className="text-lg">Overtime Summary</CardTitle> */}
                            <CardDescription className="text-base font-medium text-foreground">Note: Calculated based on standard 8 hours workday</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                                {/* Header Row */}
                                <div className="grid grid-cols-12 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                                    <div className="col-span-4">Date</div>
                                    <div className="col-span-4">Work Hours</div>
                                    <div className="col-span-4">Extra Hours</div>
                                </div>

                                {/* Rows */}
                                <div className="divide-y text-sm">
                                    {paginatedOvertime.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            No overtime records available.
                                        </div>
                                    ) : (
                                        paginatedOvertime.map((ot) => (
                                            <div
                                                key={ot.id}
                                                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors group"
                                            >
                                                <div className="col-span-4 font-medium text-foreground">
                                                    {formatDateDisplay(ot.date)}
                                                </div>
                                                <div className="col-span-4 text-muted-foreground font-mono">
                                                    {ot.workHours}
                                                </div>
                                                <div className="col-span-4">
                                                    <Badge variant={ot.extraHours === "00:00" ? "secondary" : "default"} className={cn(
                                                        "font-mono",
                                                        ot.extraHours !== "00:00" && "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                                                    )}>
                                                        {ot.extraHours}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* Overtime Pagination */}
                                <div className="flex items-center justify-between py-4 px-4 border-t">
                                    <span className="text-sm text-muted-foreground">
                                        Showing {overtimeData.length === 0 ? 0 : (currentOvertimePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentOvertimePage * ITEMS_PER_PAGE, overtimeData.length)} of {overtimeData.length} records
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleOvertimePrevPage}
                                            disabled={currentOvertimePage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleOvertimeNextPage}
                                            disabled={currentOvertimePage === totalOvertimePages || totalOvertimePages === 0}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
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
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal bg-white",
                                                    !hrDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {hrDate ? format(parseISO(hrDate), "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={hrDate ? parseISO(hrDate) : undefined}
                                                onSelect={(date: Date | undefined) => setHrDate(date ? format(date, "yyyy-MM-dd") : "")}
                                                captionLayout="dropdown"
                                                fromDate={new Date(2020, 0)}
                                                toDate={new Date(2030, 11)}
                                            />
                                        </PopoverContent>
                                    </Popover>
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
                                    <div className="col-span-3">Employee Name</div>
                                    <div className="col-span-2">Date</div>
                                    <div className="col-span-1">Check In</div>
                                    <div className="col-span-1">Check Out</div>
                                    <div className="col-span-1">Department</div>
                                    <div className="col-span-1">Work Loc.</div>
                                    <div className="col-span-1 text-center">Extra Hours</div>
                                    <div className="col-span-2 text-right">Work Hours</div>
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
                                                <div className="col-span-3 font-medium text-foreground">
                                                    {record.employeeName}
                                                </div>
                                                <div className="col-span-2 text-muted-foreground">
                                                    {record.date}
                                                </div>
                                                <div className="col-span-1 text-muted-foreground">
                                                    {record.punches[0]?.checkIn || "—"}
                                                </div>
                                                <div className="col-span-1 text-muted-foreground">
                                                    {record.punches[record.punches.length - 1]?.checkOut || "—"}
                                                </div>
                                                <div className="col-span-1 text-muted-foreground">
                                                    {record.department}
                                                </div>
                                                <div className="col-span-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {record.workLocation}
                                                    </Badge>
                                                </div>
                                                <div className="col-span-1 text-center">
                                                    <Badge variant={record.extraHours === "00:00" ? "secondary" : "default"} className={cn(
                                                        "font-mono text-xs",
                                                        record.extraHours !== "00:00" && "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                                                    )}>
                                                        {record.extraHours}
                                                    </Badge>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <Badge variant="default" className="font-mono bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                                                        {record.workHours}
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
                                    <Popover open={isBulkDatePickerOpen} onOpenChange={setIsBulkDatePickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-[240px] justify-start text-left font-normal bg-white",
                                                    !bulkDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {bulkDate ? format(bulkDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar
                                                mode="single"
                                                selected={bulkDate}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        setBulkDate(date);
                                                        setIsBulkDatePickerOpen(false);
                                                    }
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="bg-card border rounded-lg overflow-hidden shadow-sm mx-6 mb-6">
                                {/* Header Row */}
                                <div className="grid grid-cols-12 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                                    <div className="col-span-3">Employee Name</div>
                                    <div className="col-span-2">Date</div>
                                    <div className="col-span-1">Check In</div>
                                    <div className="col-span-1">Check Out</div>
                                    <div className="col-span-2">Work Hours</div>
                                    <div className="col-span-3 text-right">Action</div>
                                </div>

                                {/* Rows */}
                                <div className="divide-y text-sm">
                                    {bulkAttendanceData
                                        .filter(record =>
                                            record.employeeName.toLowerCase().includes(bulkSearchTerm.toLowerCase())
                                        )
                                        .map((record) => {
                                            const isToday = isSameDay(bulkDate, new Date());
                                            const isPast = isBefore(bulkDate, startOfDay(new Date()));

                                            // Calculate display values
                                            const firstCheckIn = record.sessions.length > 0 ? formatTimeDisplay(record.sessions[0].checkIn) : "—";
                                            const lastSession = record.sessions[record.sessions.length - 1];
                                            const lastCheckOut = lastSession?.checkOut ? formatTimeDisplay(lastSession.checkOut) : "—";
                                            const isCheckedIn = lastSession && lastSession.checkOut === null;

                                            let totalMinutes = 0;
                                            record.sessions.forEach(s => {
                                                if (s.checkIn && s.checkOut) {
                                                    totalMinutes += differenceInMinutes(parseISO(s.checkOut), parseISO(s.checkIn));
                                                }
                                            });
                                            const totalWorkHours = formatMinutesToHHMM(totalMinutes);


                                            return (
                                                <div
                                                    key={record.id}
                                                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors group cursor-pointer"
                                                    onClick={() => handleBulkRowClick(record)}
                                                >
                                                    <div className="col-span-3 font-medium text-foreground">
                                                        {record.employeeName}
                                                    </div>
                                                    <div className="col-span-2 text-muted-foreground">
                                                        {record.date}
                                                    </div>
                                                    <div className="col-span-1 text-muted-foreground">
                                                        {firstCheckIn}
                                                    </div>
                                                    <div className="col-span-1 text-muted-foreground">
                                                        {lastCheckOut}
                                                    </div>
                                                    <div className="col-span-2 font-mono">
                                                        {totalWorkHours}
                                                    </div>
                                                    <div className="col-span-3 text-right flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                        {isToday && (
                                                            isCheckedIn ? (
                                                                <Button size="sm" variant="destructive" className="h-8" onClick={() => handleBulkCheckOut(record.id)}>
                                                                    Check Out
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => handleBulkCheckIn(record.id)}>
                                                                    Check In
                                                                </Button>
                                                            )
                                                        )}

                                                        {isPast && (
                                                            <Badge variant="secondary">Read Only</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Daily Details Popup */}
            {selectedDay && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Attendance Details - {formatDateDisplay(selectedDay.date)}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {/* Read-only Employee Info Section */}
                            <div className="grid grid-cols-3 gap-4 py-3 border-b border-t mt-4 bg-muted/20 px-4 -mx-6">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Employee</span>
                                    <p className="text-sm font-semibold">{selectedDay.employeeName || "—"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Department</span>
                                    <p className="text-sm font-semibold">{selectedDay.department || "—"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Location</span>
                                    <p className="text-sm font-semibold">{selectedDay.workLocation || "—"}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-muted-foreground">Sessions</h4>
                                <ScrollArea className="h-[300px] border rounded-md">
                                    <div className="divide-y">
                                        {selectedDay.sessions.map((session, idx) => (
                                            <div key={idx} className="p-3 grid grid-cols-3 gap-2 text-sm">
                                                <div>
                                                    <span className="block text-xs text-muted-foreground">Check In</span>
                                                    <span className="font-medium">{session.checkIn}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-muted-foreground">Check Out</span>
                                                    <span className="font-medium">{session.checkOut}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-xs text-muted-foreground">Duration</span>
                                                    <span className="font-mono font-medium">{session.workHours}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="flex justify-end">
                                <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>Close</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
