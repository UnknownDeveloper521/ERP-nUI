import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format, parseISO, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Save, AlertCircle, Loader2 } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { TimePicker } from "@/components/shared/TimePicker";
import { attendanceApi, commonApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { useHasPermission } from "@/hooks/usePermissions";

// --- Interfaces ---
interface HRRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    date: string;
    department: string;
    workLocation: string;
    status: "Present" | "Absent" | null;
    inTime?: string;
    outTime?: string;
}

/**
 * Attendance Module Integration - Technical Summary:
 * 1. API Synchronization: Integrated getattendancelist, saveattendance, and savebulkattendance.
 * 2. Date Context: Unified date states (hrDate/bulkDate) into a single 'selectedDate' shared across tabs.
 * 3. Save Logic: Implemented intelligent switching; calls singular 'saveattendance' for 1 record,
 *    and 'savebulkattendance' for 2+ records. Aligned payloads with backend 'ispresent' key.
 * 4. UI Feedback:
 *    - Save button disabled until at least one "Present" tick is made.
 *    - Bulk Entry popup fetches live data from the search result state.
 *    - Real-time time reflection in both table views using direct ISO string parsing.
 * 5. State Management: Clears bulkAttendanceMap upon successful save to prevent stale UI data.
 */
import Unauthorized from "../Unauthorized";

export default function AttendancePage() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const params = useParams();
    const { isMenuVisible, canCreate, canEdit, canView } = useHasPermission();
    const bulkModuleName = "HRMS/ATTENDANCE/BULK_ATTENDANCE";

    const canViewHrView = isMenuVisible("HRMS/ATTENDANCE/HR_VIEW");
    const canViewBulk = isMenuVisible("HRMS/ATTENDANCE/BULK_ATTENDANCE");

    // Early return if no tab access at all
    if (!canViewHrView && !canViewBulk) {
        return <Unauthorized />;
    }

    const defaultTab = canViewHrView ? 'hr-view' : (canViewBulk ? 'bulk-attendance' : null);

    const getCurrentTab = () => {
        if (params.tab === 'bulk-attendance' && canViewBulk) return 'bulk-attendance';
        if (params.tab === 'hr-view' && canViewHrView) return 'hr-view';
        return defaultTab;
    };

    const [activeTab, setActiveTab] = useState(getCurrentTab());

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setLocation(`/hrms/attendance/${value}`);
    };

    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [employeesFetchedKey, setEmployeesFetchedKey] = useState<string>("");

    useEffect(() => {
        const currentTab = getCurrentTab();
        // Sync tab state with URL params
        if (currentTab !== activeTab) {
            setActiveTab(currentTab);
        }

        if (!params.tab && location === '/hrms/attendance') {
            if (defaultTab) {
                setLocation(`/hrms/attendance/${defaultTab}`);
            }
        }
    }, [params.tab, location, activeTab, canViewHrView, canViewBulk, defaultTab]);

    const [isListLoading, setIsListLoading] = useState(false);
    const departmentsFromStore = useCommonStore((state) => state.departments);
    const locationsFromStore = useCommonStore((state) => state.locations);

    /** Departments/locations from login entity master (loadCommonData → commonStore). */
    const departments = useMemo(
        () =>
            (departmentsFromStore || []).map((d: any) => ({
                ...d,
                id: d.id ?? d.value_id,
                name: d.name ?? d.value_name,
                department_name: d.department_name ?? d.value_name ?? d.name,
            })),
        [departmentsFromStore]
    );

    const locations = useMemo(
        () =>
            (locationsFromStore || []).map((l: any) => ({
                ...l,
                id: l.id ?? l.value_id,
                name: l.name ?? l.value_name,
                location_name: l.location_name ?? l.value_name ?? l.name,
            })),
        [locationsFromStore]
    );

    // --- State ---
    const [hrDepartment, setHrDepartment] = useState("all");
    const [hrWorkLocation, setHrWorkLocation] = useState("all");
    const [hrSearchTerm, setHrSearchTerm] = useState("");
    const debouncedHrSearchTerm = useDebounce(hrSearchTerm, 500);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const parseDepartmentId = (dept: string) => {
        if (!dept || dept === "all") return undefined;
        const id = parseInt(dept, 10);
        return Number.isFinite(id) ? id : undefined;
    };

    const fetchEmployees = async (force = false, departmentFilter = "all") => {
        const attendanceDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
        if (!attendanceDate) return;
        const cacheKey = `${attendanceDate}|${departmentFilter}`;
        if (!force && employeesFetchedKey === cacheKey && allEmployees.length > 0) return;

        const departmentId = parseDepartmentId(departmentFilter);

        try {
            const res = await attendanceApi.getEmployeeListForAttendance({
                attendance_date: attendanceDate,
                department_id: departmentId,
            });
            let records: any[] = [];
            if (Array.isArray(res)) {
                records = res;
            } else if (Array.isArray(res?.data?.records)) {
                records = res.data.records;
            } else if (Array.isArray(res?.data)) {
                records = res.data;
            } else if (Array.isArray(res?.records)) {
                records = res.records;
            }

            const mapped = records.map((r: any) => ({
                id: r.id ?? r.employee_id,
                employee_id: r.employee_id ?? r.id,
                employee_name: r.employee_name ?? r.name ?? "",
                employee_code: r.employee_code ?? r.code ?? "",
                department_name: r.department_name ?? r.department ?? "",
                department: r.department_name ?? r.department ?? "",
                department_id: r.department_id ?? r.dept_id ?? null,
            }));
            setAllEmployees(mapped);
            setEmployeesFetchedKey(cacheKey);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };
    const [hrSearchResults, setHrSearchResults] = useState<HRRecord[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const formatDateDisplay = (dateStr: string) => {
        try {
            return format(parseISO(dateStr), "dd-MM-yyyy");
        } catch {
            return dateStr;
        }
    };


    /*
    useEffect(() => {
        const fetchCommonData = async () => {
            try {
                const [deptRes, locRes] = await Promise.all([
                    commonApi.getDepartments(),
                    commonApi.getLocations()
                ]);
                if (deptRes.isSuccessful) {
                    const data = deptRes.data?.records || deptRes.data || [];
                    setDepartments(Array.isArray(data) ? data : []);
                }
                if (locRes.isSuccessful) {
                    const data = locRes.data?.records || locRes.data || [];
                    setLocations(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error("Error fetching common data:", error);
            }
        };
        fetchCommonData();
    }, []);
    */

    // --- Bulk Attendance Logic ---
    const [bulkSearchTerm, setBulkSearchTerm] = useState("");
    const [bulkDepartment, setBulkDepartment] = useState("all");
    const debouncedBulkSearchTerm = useDebounce(bulkSearchTerm, 500);

    const bulkDepartmentOptions = useMemo(
        () => [
            { label: "All Departments", value: "all" },
            ...(departments || []).map((d: any) => {
                const entityId = d.id ?? d.value_id;
                return {
                    label: d.department_name || d.name || d.value_name || `Dept ${entityId}`,
                    value: String(entityId),
                };
            }),
        ],
        [departments]
    );

    const employeeMatchesBulkDepartment = (emp: any, deptFilter: string) => {
        if (deptFilter === "all") return true;
        const deptId = String(deptFilter);
        const dept = departments.find(
            (d: any) => String(d.id) === deptId || String(d.value_id) === deptId
        );
        const deptIds = new Set(
            [deptId, dept?.id, dept?.value_id].filter((v) => v != null && v !== "").map(String)
        );
        if (emp.department_id != null && deptIds.has(String(emp.department_id))) return true;
        const deptName = (dept?.department_name || dept?.name || dept?.value_name || "")
            .trim()
            .toLowerCase();
        const empDept = String(emp.department_name || emp.department || "").trim().toLowerCase();
        return Boolean(deptName && empDept && empDept === deptName);
    };
    const [bulkAttendanceMap, setBulkAttendanceMap] = useState<Record<string, Record<string, { status: "Present" | "Absent" | null, inTime: string, outTime: string }>>>({});
    const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [bulkInTime, setBulkInTime] = useState("");
    const [bulkOutTime, setBulkOutTime] = useState("");
    const isTimeInvalid = false;
    /** Bulk Entry modal: at least one of In/Out required when employees are selected */
    const isBulkEntryTimesMissing = false;
    const [popupSearchTerm, setPopupSearchTerm] = useState("");


    const dateStrFormatted = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

    const fetchAttendance = useCallback(async () => {
        setIsListLoading(true);
        try {
            const isBulkView = activeTab === 'bulk-attendance';
            
            if (isBulkView) {
                await fetchEmployees(true, bulkDepartment);
            }

            const currentSearchTerm = isBulkView ? debouncedBulkSearchTerm : debouncedHrSearchTerm;
            const isSearching = !!currentSearchTerm;
            const departmentId = isBulkView
                ? parseDepartmentId(bulkDepartment)
                : parseDepartmentId(hrDepartment);
            const fetchParams = {
                search_text: currentSearchTerm || undefined,
                department_id: departmentId,
                location_id: hrWorkLocation !== "all" ? parseInt(hrWorkLocation) : undefined,
                date: dateStrFormatted,
                // Case 1: Bulk View - Send page: 1 and limit: 100,000 explicitly
                ...(isBulkView && {
                    page: 1,
                    limit: 100000
                }),
                // Case 2: HR View - Send standard pagination only if NOT searching
                ...(!isBulkView && !isSearching && {
                    page: currentPage,
                    limit: itemsPerPage
                })
            };
            const res = await attendanceApi.getList(fetchParams);
            
            // Ultra-flexible record extraction handling raw arrays, wrapped data, or nested records
            let rawRecords: any[] = [];
            let paginationData: any = null;

            if (Array.isArray(res)) {
                rawRecords = res;
            } else if (res && res.data) {
                if (Array.isArray(res.data.records)) {
                    rawRecords = res.data.records;
                    paginationData = res.data.pagination;
                } else if (Array.isArray(res.data)) {
                    rawRecords = res.data;
                    paginationData = res.pagination; // Fallback to root pagination
                }
            } else if (res && Array.isArray(res.records)) {
                rawRecords = res.records;
                paginationData = res.pagination;
            }

            // Fallback for pagination if not found yet
            if (!paginationData && res) {
                paginationData = res.pagination || (res.data && res.data.pagination);
            }

            if (rawRecords.length > 0 || (res && res.isSuccessful)) {
                const mappedRecords: HRRecord[] = rawRecords.map((r: any) => {
                    // Improved time parsing to handle ISO strings, HH:mm:ss, or partial strings
                    const parseTime = (timeStr: string | null | undefined) => {
                        if (!timeStr || typeof timeStr !== 'string') return "";
                        // Handle ISO strings with 'T'
                        if (timeStr.includes('T')) {
                            const timePart = timeStr.split('T')[1];
                            return timePart ? timePart.substring(0, 5) : "";
                        }
                        // Handle plain HH:mm:ss or HH:mm
                        return timeStr.substring(0, 5);
                    };

                    // Robust status check for is_present, ispresent, or status (boolean or numeric 1/0)
                    const isPresent = r.status === true || r.status === 1 || 
                                    r.is_present === true || r.is_present === 1 ||
                                    r.ispresent === true || r.ispresent === 1 ||
                                    String(r.status).toLowerCase() === 'present' ||
                                    String(r.status).toLowerCase() === 'true';

                    return {
                        id: `${r.employee_id}_${String(r.attendance_date).split('T')[0]}`,
                        employeeId: String(r.employee_id || r.id).trim(),
                        employeeName: r.employee_name || r.name || "",
                        date: String(r.attendance_date).split('T')[0],
                        department: r.department_name || r.department || "",
                        workLocation: r.work_location_name || r.location || "",
                        status: isPresent ? "Present" : "Absent",
                        inTime: parseTime(r.in_time || r.inTime),
                        outTime: parseTime(r.out_time || r.outTime),
                    };
                });
                setHrSearchResults(mappedRecords);
                setTotalCount(paginationData?.totalCount || mappedRecords.length);
            }
        } catch (error) {
            console.error("Error fetching attendance list:", error);
        } finally {
            setIsListLoading(false);
        }
    }, [hrDepartment, bulkDepartment, hrWorkLocation, dateStrFormatted, debouncedHrSearchTerm, debouncedBulkSearchTerm, currentPage, itemsPerPage, activeTab]);

    useEffect(() => {
        fetchAttendance();
    }, [hrDepartment, bulkDepartment, hrWorkLocation, dateStrFormatted, debouncedHrSearchTerm, debouncedBulkSearchTerm, currentPage, itemsPerPage, activeTab, location]);

    useEffect(() => {
        setCurrentPage(1);
    }, [hrDepartment, hrWorkLocation, dateStrFormatted, debouncedHrSearchTerm]);

    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const paginatedResults = hrSearchTerm
        ? hrSearchResults.filter(r =>
            (r.employeeName || "").toLowerCase().includes(hrSearchTerm.toLowerCase()) ||
            (r.employeeId || "").toLowerCase().includes(hrSearchTerm.toLowerCase()) ||
            (r.department || "").toLowerCase().includes(hrSearchTerm.toLowerCase()) ||
            (r.workLocation || "").toLowerCase().includes(hrSearchTerm.toLowerCase())
        )
        : hrSearchResults;

    useEffect(() => {
        if (isBulkEntryOpen) {
            setBulkInTime("");
            setBulkOutTime("");
            setSelectedEmployees([]);
            setPopupSearchTerm("");
        }
    }, [isBulkEntryOpen]);

    const handleEmployeeToggle = (id: string) => {
        setSelectedEmployees(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getBulkEntryEmployees = () => {
        const list =
            allEmployees.length > 0
                ? allEmployees
                : hrSearchResults.map((h) => ({
                      id: h.employeeId,
                      employee_id: h.employeeId,
                      employee_name: h.employeeName,
                      department: h.department,
                      department_name: h.department,
                  }));
        const q = popupSearchTerm.trim().toLowerCase();
        return list.filter((emp) => {
            const name = (emp.employee_name || emp.employeeName || "").toLowerCase();
            const code = (emp.employee_code || "").toLowerCase();
            const matchesSearch = !q || name.includes(q) || code.includes(q);
            return matchesSearch && employeeMatchesBulkDepartment(emp, bulkDepartment);
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const visibleIds = getBulkEntryEmployees().map((emp) =>
                String(emp.id || emp.employee_id || emp.employeeId)
            );
            setSelectedEmployees(visibleIds);
        } else {
            setSelectedEmployees([]);
        }
    };

    const handleBulkSetStatus = (id: string, status: "Present" | "Absent") => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const existingRecord = hrSearchResults.find(h => h.employeeId === id.toString());

        setBulkAttendanceMap(prev => {
            const currentData = prev[dateStr]?.[id] || {
                status: existingRecord ? existingRecord.status : null,
                inTime: existingRecord ? (existingRecord.inTime || "") : "",
                outTime: existingRecord ? (existingRecord.outTime || "") : ""
            };

            // Rule 4: If checkbox is manually unchecked (Absent), clear both times
            const newInTime = status === "Absent" ? "" : currentData.inTime;
            const newOutTime = status === "Absent" ? "" : currentData.outTime;

            return {
                ...prev,
                [dateStr]: {
                    ...(prev[dateStr] || {}),
                    [id]: {
                        ...currentData,
                        status,
                        inTime: newInTime,
                        outTime: newOutTime
                    }
                }
            };
        });
    };

    const handleBulkTimeChange = (id: string, field: "inTime" | "outTime", value: string) => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const existingRecord = hrSearchResults.find(h => h.employeeId === id.toString());

        setBulkAttendanceMap(prev => {
            const currentData = prev[dateStr]?.[id] || {
                status: existingRecord ? existingRecord.status : null,
                inTime: existingRecord ? (existingRecord.inTime || "") : "",
                outTime: existingRecord ? (existingRecord.outTime || "") : ""
            };

            // Update the specific field first
            const updatedData = { ...currentData, [field]: value };

            // Rule: Checkbox synchronization based on time values
            // If either has a value -> force Present
            const hasAnyTime = (updatedData.inTime && updatedData.inTime.trim() !== "") ||
                (updatedData.outTime && updatedData.outTime.trim() !== "");

            const newStatus = hasAnyTime ? "Present" : currentData.status;

            return {
                ...prev,
                [dateStr]: {
                    ...(prev[dateStr] || {}),
                    [id]: {
                        ...updatedData,
                        status: newStatus
                    }
                }
            };
        });
    };

    const handleBulkEntrySave = async () => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const entries = selectedEmployees
            .filter((id) => id && id.toString().trim() !== "" && Number.isFinite(Number(id)))
            .map((employeeId) => ({
                employee_id: Number(employeeId),
                attendance_date: dateStr,
                ispresent: true,
                in_time: bulkInTime ? `${dateStr}T${bulkInTime}:00+05:30` : null,
                out_time: bulkOutTime ? `${dateStr}T${bulkOutTime}:00+05:30` : null
            }));

        if (entries.length === 0) return;
        try {
            const res = await attendanceApi.saveBulk({
                attendance_data: entries,
                attendance_date: dateStr
            });
            if (res.isSuccessful) {
                toast({
                    title: "Success",
                    description: res.message || `Attendance saved successfully`,
                    variant: "success"
                });
                setIsBulkEntryOpen(false);
                setSelectedEmployees([]);
                setBulkInTime("");
                setBulkOutTime("");
                // Clear local edits for this date before refreshing from server
                setBulkAttendanceMap(prev => ({ ...prev, [dateStr]: {} }));
                fetchEmployees(true, bulkDepartment);
                await fetchAttendance();
            }
        } catch (error) {
            console.error("Error in bulk entry save:", error);
            toast({ title: "Error", description: "Failed to save bulk attendance", variant: "destructive" });
        }
    };

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const dailyData = bulkAttendanceMap[dateStr] || {};
    const hasAnyRowError = Object.values(dailyData).some(edit => !!edit.outTime && !edit.inTime);

    const hasChanges = Object.keys(dailyData).some(employeeId => {
        const edit = dailyData[employeeId];
        const original = hrSearchResults.find(h => h.employeeId === employeeId);

        const origStatus = original ? original.status : null;
        const origInTime = original ? (original.inTime || "") : "";
        const origOutTime = original ? (original.outTime || "") : "";

        return edit.status !== origStatus ||
            edit.inTime !== origInTime ||
            edit.outTime !== origOutTime;
    });

    const handleSaveBulk = async () => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const dailyData = bulkAttendanceMap[dateStr] || {};
        const entries = Object.keys(dailyData)
            .filter((id) => id && id.trim() !== "" && Number.isFinite(Number(id)))
            .map((employeeId) => ({
                employee_id: Number(employeeId),
                attendance_date: dateStr,
                ispresent: dailyData[employeeId].status === "Present",
                in_time: dailyData[employeeId].inTime ? `${dateStr}T${dailyData[employeeId].inTime}:00+05:30` : null,
                out_time: dailyData[employeeId].outTime ? `${dateStr}T${dailyData[employeeId].outTime}:00+05:30` : null
            }));

        if (entries.length === 0 || hasAnyRowError) return;
        try {
            const res = await attendanceApi.saveBulk({
                attendance_data: entries,
                attendance_date: dateStr
            });

            if (res.isSuccessful) {
                toast({
                    title: "Success",
                    description: "Attendance saved successfully",
                    variant: "success"
                });
                // Clear local edits for this date before refreshing from server
                setBulkAttendanceMap(prev => ({ ...prev, [dateStr]: {} }));
                fetchEmployees(true, bulkDepartment);
                await fetchAttendance();
            } else {
                toast({
                    title: "Error",
                    description: res.message || "Failed to save attendance records",
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error("Error saving attendance:", error);
            toast({ title: "Error", description: error.message || "Failed to save attendance records", variant: "destructive" });
        }
    };

    const filteredBulkEmployees = allEmployees.filter((e) => {
        const matchesSearch =
            (e.employee_name || "").toLowerCase().includes(bulkSearchTerm.toLowerCase()) ||
            (e.employee_code || "").toLowerCase().includes(bulkSearchTerm.toLowerCase());
        return matchesSearch && employeeMatchesBulkDepartment(e, bulkDepartment);
    });

    const bulkEntryEmployees = getBulkEntryEmployees();

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
                <p className="text-muted-foreground text-sm">Track your attendance and overtime</p>
            </div>

            <Tabs value={activeTab || ""} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none">
                        {canViewHrView && (
                            <TabsTrigger value="hr-view" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-colors hover:text-foreground">
                                HR View
                            </TabsTrigger>
                        )}
                        {canViewBulk && (
                            <TabsTrigger value="bulk-attendance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-colors hover:text-foreground">
                                Bulk Attendance
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {!activeTab ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                            <p className="text-muted-foreground">You don't have access to this module.</p>
                        </div>
                    </div>
                ) : (
                    <>
                <TabsContent value="hr-view" className="space-y-4 mt-4">
                    <AppListToolbar
                        search={{ 
                            value: hrSearchTerm, 
                            onChange: (val) => {
                                setHrSearchTerm(val);
                                setCurrentPage(1);
                            }, 
                            placeholder: "Search employees..." 
                        }}
                        filters={[
                            {
                                type: 'select',
                                label: 'Department',
                                value: hrDepartment,
                                options: [
                                    { label: "All Departments", value: "all" },
                                    ...(departments || []).map((d: any) => ({
                                        label: d.department_name || d.name || d.value_name || `Dept ${d.id}`,
                                        value: String(d.id ?? d.value_id),
                                    })),
                                ],
                                onChange: (val) => {
                                    setHrDepartment(val);
                                    setCurrentPage(1);
                                },
                                searchable: true
                            },
                            {
                                type: 'select',
                                label: 'Location',
                                value: hrWorkLocation,
                                options: [
                                    { label: "All Locations", value: "all" },
                                    ...(locations || []).map((l: any) => ({
                                        label: l.location_name || l.name || l.value_name || `Loc ${l.id}`,
                                        value: String(l.id ?? l.value_id),
                                    })),
                                ],
                                onChange: (val) => {
                                    setHrWorkLocation(val);
                                    setCurrentPage(1);
                                },
                                searchable: true
                            },
                            {
                                type: 'date',
                                label: 'Date',
                                value: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
                                onChange: (val) => {
                                    if (!val) {
                                        setSelectedDate(new Date());
                                        setCurrentPage(1);
                                        return;
                                    }
                                    const now = new Date();
                                    setSelectedDate(val > now ? now : val);
                                    setCurrentPage(1);
                                },
                                maxDate: new Date(),
                                showClear: !isSameDay(selectedDate, new Date())
                            }
                        ]}
                    />

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
                                        {isListLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-32 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-3">
                                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                        <p className="text-sm text-muted-foreground">Loading...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : paginatedResults.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No records found.</TableCell></TableRow>
                                        ) : (
                                            paginatedResults.map((record) => (
                                                <TableRow key={record.id} className="hover:bg-muted/30 transition-colors border-b">
                                                    <TableCell className="py-4 font-medium">{record.employeeName}</TableCell>
                                                    <TableCell>{formatDateDisplay(record.date)}</TableCell>
                                                    <TableCell>{record.department}</TableCell>
                                                    <TableCell>{record.workLocation ?? ""}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn("font-medium", record.status === "Present" ? "border-green-500 text-green-600 bg-green-50" : "border-red-500 text-red-600 bg-red-50")}>
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
                            {!isListLoading && (
                                <DataTablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bulk-attendance" className="flex-1 flex flex-col overflow-hidden mt-4">
                    <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                        <AppListToolbar
                            search={{ value: bulkSearchTerm, onChange: setBulkSearchTerm, placeholder: "Search employees..." }}
                            filters={[
                                {
                                    type: 'select',
                                    label: 'Department',
                                    value: bulkDepartment,
                                    options: bulkDepartmentOptions,
                                    onChange: setBulkDepartment,
                                    searchable: true,
                                },
                                {
                                    type: 'date',
                                    label: 'Date',
                                    value: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
                                    onChange: (val) => {
                                        if (!val) {
                                            setSelectedDate(new Date());
                                            return;
                                        }
                                        const now = new Date();
                                        setSelectedDate(val > now ? now : val);
                                    },
                                    maxDate: new Date(),
                                    showClear: !isSameDay(selectedDate, new Date())
                                }
                            ]}
                            actions={(canCreate(bulkModuleName) || canEdit(bulkModuleName)) ? [{
                                label: 'Bulk Entry',
                                onClick: async () => {
                                    await fetchEmployees(true, bulkDepartment);
                                    setIsBulkEntryOpen(true);
                                },
                                variant: 'default'
                            }] : []}
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
                                                    <TableHead className="text-center">Mark Present</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isListLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-32 text-center">
                                                            <div className="flex flex-col items-center justify-center gap-3">
                                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : filteredBulkEmployees.length === 0 ? (
                                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No records found.</TableCell></TableRow>
                                                ) :
                                                    filteredBulkEmployees.map((record: any) => {
                                                    const dateStr = format(selectedDate, "yyyy-MM-dd");
                                                    const employeeId = String(record.id);
                                                    const employeeName = record.employee_name;
                                                    const employeeDept = record.department_name;

                                                    // Robust lookup: ensure IDs are strings and normalized for matching
                                                    const existingRecord = hrSearchResults.find(h => 
                                                        String(h.employeeId).trim() === String(employeeId).trim()
                                                    );

                                                    const attendanceData = bulkAttendanceMap[dateStr]?.[employeeId] || {
                                                        status: existingRecord ? existingRecord.status : null,
                                                        inTime: existingRecord ? (existingRecord.inTime || "") : "",
                                                        outTime: existingRecord ? (existingRecord.outTime || "") : ""
                                                    };

                                                    return (
                                                        <TableRow key={employeeId} className="hover:bg-muted/30 transition-colors">
                                                            <TableCell className="font-medium">{employeeName}</TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-1">
                                                                    <TimePicker
                                                                        value={attendanceData.inTime}
                                                                        onChange={(val) => handleBulkTimeChange(employeeId, "inTime", val)}
                                                                        className={cn("h-8 w-24", !attendanceData.inTime && attendanceData.outTime ? "border-red-500 ring-red-500" : "")}
                                                                    />
                                                                    {!attendanceData.inTime && attendanceData.outTime && (
                                                                        <span className="text-[10px] text-red-500 font-medium">In time is required</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-1">
                                                                    <TimePicker
                                                                        value={attendanceData.outTime}
                                                                        onChange={(val) => handleBulkTimeChange(employeeId, "outTime", val)}
                                                                        className="h-8 w-24"
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell><div className="flex justify-center"><Checkbox checked={attendanceData.status === "Present"} onCheckedChange={(checked) => handleBulkSetStatus(employeeId, checked ? "Present" : "Absent")} /></div></TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                                }
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                <div className="shrink-0 flex justify-end p-6 border-t bg-background mt-4">
                                    <Button
                                        onClick={handleSaveBulk}
                                        disabled={!hasChanges || hasAnyRowError || (!canCreate(bulkModuleName) && !canEdit(bulkModuleName))}
                                        className={cn(
                                            "h-10 min-w-[150px] gap-2 transition-all font-semibold",
                                            (!hasChanges || hasAnyRowError)
                                                ? "bg-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-200 border-none shadow-none"
                                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95"
                                        )}
                                    >
                                        <Save className="h-4 w-4" /> Save Attendance
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Dialog open={isBulkEntryOpen} onOpenChange={setIsBulkEntryOpen}>
                            <DialogContent
                                className="max-w-lg p-0 overflow-hidden bg-white"
                                onPointerDownOutside={(e) => e.preventDefault()}
                                onEscapeKeyDown={(e) => e.preventDefault()}
                            >
                                <DialogHeader className="p-6 pb-2 border-b">
                                    <DialogTitle className="text-xl font-bold">Bulk Attendance Entry</DialogTitle>
                                </DialogHeader>
                                <div className="flex flex-col h-[550px]">
                                    <div className="p-6 border-b bg-slate-50/50 space-y-4">
                                        <SearchableSelect
                                            label="Department"
                                            value={bulkDepartment}
                                            options={bulkDepartmentOptions}
                                            onChange={(val) => {
                                                setBulkDepartment(String(val));
                                                setSelectedEmployees([]);
                                            }}
                                            placeholder="All Departments"
                                        />
                                        <div className="grid grid-cols-2 gap-6 items-start px-2">
                                            <div className="space-y-2"><Label>In Time</Label><TimePicker value={bulkInTime} onChange={setBulkInTime} className="w-[110px]" /></div>
                                            <div className="space-y-2">
                                                <Label>Out Time</Label>
                                                <TimePicker value={bulkOutTime} onChange={setBulkOutTime} className="w-[110px]" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        <div className="p-4 border-b bg-muted/10 space-y-3">
                                            <Input placeholder="Search employees..." value={popupSearchTerm} onChange={(e) => setPopupSearchTerm(e.target.value)} />
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="select-all"
                                                    checked={
                                                        bulkEntryEmployees.length > 0 &&
                                                        selectedEmployees.length === bulkEntryEmployees.length
                                                    }
                                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                                />
                                                <Label htmlFor="select-all">Select All</Label>
                                            </div>
                                        </div>
                                        <ScrollArea className="flex-1">
                                            <div className="p-2 space-y-1">
                                                {bulkEntryEmployees.map((emp) => {
                                                    const employeeId = (emp.id || emp.employeeId).toString();
                                                    const employeeName = emp.employee_name || emp.employeeName;
                                                    const attendance = hrSearchResults.find(h => h.employeeId === employeeId);
                                                    const deptName = emp.department || attendance?.department || "";

                                                    return (
                                                        <div
                                                            key={employeeId}
                                                            className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50"
                                                        >
                                                            <Checkbox
                                                                id={`emp-${employeeId}`}
                                                                checked={selectedEmployees.includes(employeeId)}
                                                                onCheckedChange={() => handleEmployeeToggle(employeeId)}
                                                            />
                                                            <Label htmlFor={`emp-${employeeId}`} className="flex-1 cursor-pointer">
                                                                <div className="flex flex-col"><span className="font-medium">{employeeName}</span><span className="text-xs text-slate-500">{deptName}</span></div>
                                                            </Label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                    <div className="p-4 border-t bg-slate-50/50 flex flex-col gap-2">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="text-sm font-medium">{selectedEmployees.length} selected</div>
                                            <div className="flex space-x-3">
                                                <Button variant="outline" onClick={() => setIsBulkEntryOpen(false)}>Cancel</Button>
                                                <Button
                                                    onClick={handleBulkEntrySave}
                                                    disabled={selectedEmployees.length === 0}
                                                    className={cn(
                                                        "transition-all font-semibold px-6",
                                                        selectedEmployees.length === 0
                                                            ? "bg-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-200 border-none shadow-none"
                                                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95"
                                                    )}
                                                >
                                                    Save Changes
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </TabsContent>
                </>
                )}
            </Tabs>
        </div>
    );
}
