import React, { useState, useEffect, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInputBorderless, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Edit, ChevronsUpDown, Check, ChevronDown, X, Trash2, Search, AlertCircle, Loader2 } from "lucide-react";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { format, parse } from "date-fns";
import { cn, resolveFileUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import ImprovedLeaveCalendar from "@/components/hrms/ImprovedLeaveCalendar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveManagementApi, commonApi, LeaveRecord } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { isLeaveTypeEntityName } from "@/services/loadCommonData";
import { useHasPermission } from "@/hooks/usePermissions";


// Tabs configuration - Leave Entry, Calendar
const tabsConfig = [
  { id: "leave-entry", label: "Leave Entry", permissionKey: "HRMS:Leave Management:Leave Entry" },
  { id: "calendar", label: "Calendar", permissionKey: "HRMS:Leave Management:Calendar" }
];

interface LeaveApplication {
  id: string;
  employeeCode: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  paidLeave: boolean;
  remark: string;
}

function LeaveFormDatePicker({ date, setDate, disabled = false, minDate }: { date?: Date, setDate: (d?: Date) => void, disabled?: boolean, minDate?: Date }) {
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

    // Normalize minDate to midnight for comparison
    const normalizedMinDate = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0, 0) : null;

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const currentDate = new Date(year, month - 1, prevMonthLastDay - i);
      const normalizedCurrentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
      const isDisabled = normalizedMinDate ? normalizedCurrentDate < normalizedMinDate : false;
      days.push({
        date: currentDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const normalizedCurrentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
      const today = new Date();
      const isToday = currentDate.toDateString() === today.toDateString();
      const isSelected = date && currentDate.toDateString() === date.toDateString();
      const isDisabled = normalizedMinDate ? normalizedCurrentDate < normalizedMinDate : false;

      days.push({
        date: currentDate,
        isCurrentMonth: true,
        isToday,
        isSelected,
        isDisabled
      });
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const currentDate = new Date(year, month + 1, day);
      const normalizedCurrentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
      const isDisabled = normalizedMinDate ? normalizedCurrentDate < normalizedMinDate : false;
      days.push({
        date: currentDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled
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
                day.isCurrentMonth && "hover:bg-accent hover:text-accent-foreground",
                day.isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
              )}
              onClick={() => !day.isDisabled && handleDateSelect(day.date)}
              disabled={day.isDisabled}
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
            "w-full justify-start text-left font-normal flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-transparent",
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


import Unauthorized from "../Unauthorized";

export default function LeaveManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMenuVisible, hasPermission, canCreate, canEdit, canDelete } = useHasPermission();
  const leaveEntryModuleName = "HRMS:Leave Management:Leave Entry";

  const visibleTabs = React.useMemo(() => {
      return tabsConfig.filter(tab => isMenuVisible(tab.permissionKey));
  }, [isMenuVisible]);

  // Early return if no tab access at all
  if (visibleTabs.length === 0) {
    return <Unauthorized />;
  }

  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].id : null;

  const [activeTab, setActiveTab] = useState(() => {
    const currentTab = location.split('/').pop();
    if (visibleTabs.some(t => t.id === currentTab)) {
      return currentTab as 'leave-entry' | 'calendar';
    }
    return defaultTab || (visibleTabs.length > 0 ? visibleTabs[0].id : "leave-entry") as 'leave-entry' | 'calendar';
  });

  // Sync tab with URL and handle redirection
  useEffect(() => {
    const currentTabInPath = location.split('/').pop();
    
    // 1. If we're at the base path, redirect to default tab
    if (location === "/hrms/leave-management" && defaultTab) {
      setActiveTab(defaultTab);
      setLocation(`/hrms/leave-management/${defaultTab}`);
      return;
    }

    // 2. If current tab in path is unauthorized, redirect to default authorized tab
    if (currentTabInPath && (currentTabInPath === 'leave-entry' || currentTabInPath === 'calendar')) {
      const isCurrentAuthorized = visibleTabs.some(t => t.id === currentTabInPath);
      if (!isCurrentAuthorized && defaultTab) {
        setActiveTab(defaultTab);
        setLocation(`/hrms/leave-management/${defaultTab}`);
      }
    }
  }, [location, defaultTab, visibleTabs, setLocation]);

  // Calendar state
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Leave Entry Tab State - Filters
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [dateRangeFrom, setDateRangeFrom] = useState<Date | undefined>(undefined);
  const [dateRangeTo, setDateRangeTo] = useState<Date | undefined>(undefined);

  // Pagination State
  const [leaveEntryCurrentPage, setLeaveEntryCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal State (needed before queries for lazy loading)
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);

  // Queries
  const { data: leavesData, isLoading: isLeavesLoading } = useQuery({
    queryKey: ["leaves", leaveEntryCurrentPage, itemsPerPage, debouncedSearchQuery, dateRangeFrom, dateRangeTo],
    queryFn: () => leaveManagementApi.getList({
      page: leaveEntryCurrentPage,
      limit: itemsPerPage,
      search: debouncedSearchQuery,
      from_date: dateRangeFrom ? format(dateRangeFrom, 'yyyy-MM-dd') : undefined,
      to_date: dateRangeTo ? format(dateRangeTo, 'yyyy-MM-dd') : undefined,
    }),
    enabled: activeTab === "leave-entry", // Only fetch when on Leave Entry tab
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const { data: employeesDropdownData } = useQuery({
    queryKey: ["employees-dropdown"],
    queryFn: () => commonApi.getEmployees({ employment_status_id: 17 }),
    enabled: isAddEditModalOpen, // Only fetch when dialog is open
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const leaveTypesFromStore = useCommonStore((state) => state.leaveTypes);
  const entityValuesFromStore = useCommonStore((state) => state.entityValues);

  /*
  const { data: leaveTypesDropdownData } = useQuery({
    queryKey: ["leave-types-dropdown"],
    queryFn: () => commonApi.getLeaveTypes(),
    enabled: isAddEditModalOpen, // Only fetch when dialog is open
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const leaveTypeOptions = leaveTypesDropdownData?.data?.records || [];
  */

  const { data: calendarData } = useQuery({
    queryKey: ["leave-calendar", currentDate.getMonth() + 1, currentDate.getFullYear()],
    queryFn: () => leaveManagementApi.getCalendar(currentDate.getMonth() + 1, currentDate.getFullYear()),
    enabled: activeTab === "calendar",
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const employeeOptions = employeesDropdownData?.data?.records || [];
  
  // Table data for Leave Entry tab (Paginated)
  const leaveApplications = leavesData?.data?.records || [];

  // Leave types from login entity master (getleavetype / LEAVE_TYPE); fallback to entityValues if slice empty
  const leaveTypeOptions = useMemo(() => {
    const mapRow = (r: any) => ({
      id: r.id,
      leave_type_name: r.leave_type_name ?? r.value_name ?? r.name ?? "",
    });
    const fromSlice = (leaveTypesFromStore || []).map(mapRow);
    if (fromSlice.length > 0) return fromSlice;
    return (entityValuesFromStore || [])
      .filter((r: any) => isLeaveTypeEntityName(r.entity_type_name))
      .map(mapRow);
  }, [leaveTypesFromStore, entityValuesFromStore]);

  /**
   * Data Transformation for Calendar - Separate from Table
   * Transforms nested employee-leave structure into flat arrays for the original component
   */
  const calendarEmployees = (calendarData?.data?.employees || []).map((emp: any) => 
    typeof emp.employee_name === 'object' && emp.employee_name !== null 
      ? (emp.employee_name as any).employee_name 
      : emp.employee_name
  );

  const calendarLeaveApplications = (calendarData?.data?.employees || []).flatMap((emp: any) => 
    (emp.leaves || []).map((leave: any) => ({
      id: `${emp.employee_code}-${leave.from_date}`,
      employeeCode: emp.employee_code,
      employeeName: typeof emp.employee_name === 'object' && emp.employee_name !== null 
        ? (emp.employee_name as any).employee_name 
        : emp.employee_name,
      leaveType: typeof leave.leave_type_name === 'object' && leave.leave_type_name !== null 
        ? (leave.leave_type_name as any).leave_type_name 
        : leave.leave_type_name,
      fromDate: leave.from_date,
      toDate: leave.to_date,
      paidLeave: leave.is_paid_leave,
      remark: leave.remarks
    }))
  );

  const leaveTypeColors: { [key: string]: string } = {
    'Paid Leave': '#3b82f6',
    'Sick Leave': '#ef4444',
    'Casual Leave': '#f59e0b',
    'Annual Leave': '#10b981',
    'Unpaid Leave': '#6b7280'
  };
  const totalLeaves = leavesData?.data?.pagination?.total || 0;

  // Leave Entry Form State
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    employee_id: "",
    leave_type_id: "",
    fromDate: undefined as Date | undefined,
    toDate: undefined as Date | undefined,
    paidLeave: true,
    remark: "",
    attachments: [] as { id: number; file_name: string; file_url: string }[],
    newFiles: [] as File[]
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [editingLeave, setEditingLeave] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<number | null>(null);

  // Get employee joining date from the already-fetched employee dropdown data
  const selectedEmployee = employeeOptions.find((emp: any) => String(emp.id) === String(formData.employee_id));
  const employeeJoiningDate = selectedEmployee?.date_of_joining 
    ? (() => {
        // Parse the date string carefully to avoid timezone issues
        const dateStr = selectedEmployee.date_of_joining;
        // If it's in YYYY-MM-DD format, parse it as local date
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day); // month is 0-indexed
        }
        // Otherwise use default Date constructor
        return new Date(dateStr);
      })()
    : undefined;

  // Auto-clear dates if they're before joining date when employee changes
  useEffect(() => {
    if (employeeJoiningDate && formData.fromDate) {
      const fromDate = formData.fromDate instanceof Date ? formData.fromDate : new Date(formData.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      const joiningDate = new Date(employeeJoiningDate);
      joiningDate.setHours(0, 0, 0, 0);
      
      if (fromDate < joiningDate) {
        setFormData(prev => ({ ...prev, fromDate: undefined, toDate: undefined }));
        setFormErrors(prev => ({ ...prev, fromDate: "Leave cannot be applied before employee's joining date" }));
      }
    }
    if (employeeJoiningDate && formData.toDate) {
      const toDate = formData.toDate instanceof Date ? formData.toDate : new Date(formData.toDate);
      toDate.setHours(0, 0, 0, 0);
      const joiningDate = new Date(employeeJoiningDate);
      joiningDate.setHours(0, 0, 0, 0);
      
      if (toDate < joiningDate) {
        setFormData(prev => ({ ...prev, toDate: undefined }));
      }
    }
  }, [formData.employee_id, employeeJoiningDate]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: FormData) => leaveManagementApi.create(data),
    onSuccess: (res) => {
      if (res.isSuccessful) {
        toast({ title: "Success", description: res.message, className: "bg-green-50 border-green-200 text-green-900" });
        queryClient.invalidateQueries({ queryKey: ["leaves"] });
        queryClient.invalidateQueries({ queryKey: ["leave-calendar"] });
        setIsAddEditModalOpen(false);
        resetForm();
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => leaveManagementApi.update(id, data),
    onSuccess: (res) => {
      if (res.isSuccessful) {
        toast({ title: "Success", description: res.message, className: "bg-green-50 border-green-200 text-green-900" });
        queryClient.invalidateQueries({ queryKey: ["leaves"] });
        queryClient.invalidateQueries({ queryKey: ["leave-calendar"] });
        setIsAddEditModalOpen(false);
        resetForm();
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => leaveManagementApi.delete(id),
    onSuccess: (res) => {
      if (res.isSuccessful) {
        toast({ title: "Success", description: res.message, className: "bg-green-50 border-green-200 text-green-900" });
        queryClient.invalidateQueries({ queryKey: ["leaves"] });
        queryClient.invalidateQueries({ queryKey: ["leave-calendar"] });
        setIsDeleteDialogOpen(false);
        setIsAddEditModalOpen(false);
        setEditingLeave(null);
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const deleteAttachmentsMutation = useMutation({
    mutationFn: (leaveEntryId: number) => leaveManagementApi.deleteAttachments(leaveEntryId),
    onSuccess: (res) => {
      if (res.isSuccessful) {
        toast({ title: "Success", description: res.message, className: "bg-green-50 border-green-200 text-green-900" });
        // Clear attachments from form state
        setFormData(prev => ({
          ...prev,
          attachments: []
        }));
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete attachment", variant: "destructive" });
    }
  });

  // Set initial tab based on URL
  useEffect(() => {
    const currentTab = location.split('/').pop();
    if (currentTab === 'leave-entry' || currentTab === 'calendar') {
      setActiveTab(currentTab);
    } else if (location === '/hrms/leave-management' || location === '/hrms/leave-management/') {
      if (defaultTab) {
        setLocation(`/hrms/leave-management/${defaultTab}`);
      }
    }
  }, [location, setLocation, defaultTab]);

  // Handle tab changes with URL routing
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/hrms/leave-management/${value}`);
  };

  // Calculate duration in days
  const calculateDuration = (from?: Date, to?: Date): number => {
    if (!from || !to) return 0;
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!formData.employee_id) errors.employee_id = "Employee is required";
    if (!formData.leave_type_id) errors.leave_type_id = "Leave Type is required";
    if (!formData.fromDate) errors.fromDate = "From Date is required";
    if (!formData.toDate) errors.toDate = "To Date is required";

    // Validate From Date is not before employee's joining date
    if (formData.fromDate && employeeJoiningDate) {
      const fromDate = formData.fromDate instanceof Date ? formData.fromDate : new Date(formData.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      const joiningDate = new Date(employeeJoiningDate);
      joiningDate.setHours(0, 0, 0, 0);

      if (fromDate < joiningDate) {
        errors.fromDate = "Leave cannot be applied before employee's joining date";
      }
    }

    // Validate To Date is not before From Date
    if (formData.fromDate && formData.toDate) {
      const fromDate = formData.fromDate instanceof Date ? formData.fromDate : new Date(formData.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = formData.toDate instanceof Date ? formData.toDate : new Date(formData.toDate);
      toDate.setHours(0, 0, 0, 0);

      if (toDate < fromDate) {
        errors.toDate = "To Date must be same or after From Date";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: any) => {
    // 1. Update form data
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // 2. Clear errors for the changed field
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];

      // 3. Real-time validation for date fields
      if (field === 'toDate' || field === 'fromDate') {
        const fromDate = field === 'fromDate' ? value : newData.fromDate;
        const toDate = field === 'toDate' ? value : newData.toDate;

        if (fromDate && toDate) {
          const from = fromDate instanceof Date ? fromDate : new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          const to = toDate instanceof Date ? toDate : new Date(toDate);
          to.setHours(0, 0, 0, 0);

          if (to < from) {
            newErrors.toDate = "To Date must be same or after From Date";
          } else {
            // Important: Clear the toDate error if it was previously set due to date order
            if (newErrors.toDate === "To Date must be same or after From Date") {
              delete newErrors.toDate;
            }
          }
        }
      }
      
      // Also check joining date validation in real-time
      if (field === 'fromDate' && value && employeeJoiningDate) {
        const fromDate = value instanceof Date ? value : new Date(value);
        fromDate.setHours(0, 0, 0, 0);
        const joiningDate = new Date(employeeJoiningDate);
        joiningDate.setHours(0, 0, 0, 0);

        if (fromDate < joiningDate) {
          newErrors.fromDate = "Leave cannot be applied before employee's joining date";
        }
      }

      return newErrors;
    });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      id: undefined,
      employee_id: "",
      leave_type_id: "",
      fromDate: undefined,
      toDate: undefined,
      paidLeave: true,
      remark: "",
      attachments: [],
      newFiles: []
    });
    setFormErrors({});
    setEditingLeave(null);
  };

  // Handle cancel
  const handleCancel = () => {
    resetForm();
    setIsAddEditModalOpen(false);
  };

  // Handle submit (Add or Edit)
  const handleSubmit = () => {
    if (!validateForm()) return;

    const fd = new FormData();
    fd.append("employee_id", String(formData.employee_id));
    fd.append("leave_type_id", String(formData.leave_type_id));
    fd.append("from_date", formData.fromDate ? format(formData.fromDate, 'yyyy-MM-dd') : '');
    fd.append("to_date", formData.toDate ? format(formData.toDate, 'yyyy-MM-dd') : '');
    fd.append("is_paid_leave", String(formData.paidLeave));
    fd.append("remarks", formData.remark);

    if (formData.newFiles && formData.newFiles.length > 0) {
      formData.newFiles.forEach(file => {
        fd.append("attachments", file);
      });
    }

    // Include existing attachments for update if necessary (server might need them to know what to keep)
    if (editingLeave) {
      fd.append("existing_attachments", JSON.stringify(formData.attachments));
      updateMutation.mutate({ id: editingLeave.id, data: fd });
    } else {
      createMutation.mutate(fd);
    }
  };

  // Handle view leave details
  const handleViewLeave = (application: any) => {
    leaveManagementApi.getById(application.id).then(res => {
      if (res.isSuccessful) {
        setSelectedApplication(res.data);
        setIsViewModalOpen(true);
      }
    });
  };

  // Handle edit leave
  const handleEditLeave = (application: any) => {
    leaveManagementApi.getById(application.id).then(res => {
      if (res.isSuccessful && res.data) {
        const leave = res.data;
        setEditingLeave(leave);
        setFormData({
          id: leave.id,
          employee_id: String(leave.employee_id),
          leave_type_id: String(leave.leave_type_id),
          fromDate: new Date(leave.from_date),
          toDate: new Date(leave.to_date),
          paidLeave: leave.is_paid_leave,
          remark: leave.remarks || "",
          attachments: leave.attachments || [],
          newFiles: []
        });
        setIsAddEditModalOpen(true);
      }
    });
  };

  // Handle delete leave
  const handleDeleteLeave = (leaveId: number) => {
    setLeaveToDelete(leaveId);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (leaveToDelete) {
      deleteMutation.mutate(leaveToDelete);
      setIsViewModalOpen(false);
    }
  };

  // Use API-filtered data directly (server-side filtering and pagination)
  const filteredApplications = leaveApplications;

  // Pagination
  const leaveEntryTotalPages = Math.ceil(totalLeaves / itemsPerPage);
  const paginatedLeaveEntries = filteredApplications;

  // Auto-adjust page when data changes
  useEffect(() => {
    if (leaveEntryCurrentPage > leaveEntryTotalPages && leaveEntryTotalPages > 0) {
      setLeaveEntryCurrentPage(leaveEntryTotalPages);
    }
  }, [totalLeaves, leaveEntryCurrentPage, leaveEntryTotalPages]);

  // Reset to page 1 when search or date filters change
  useEffect(() => {
    setLeaveEntryCurrentPage(1);
  }, [searchQuery, dateRangeFrom, dateRangeTo]);

  // Format date for display - DD-MM-YYYY format
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      // Handle both YYYY-MM-DD and DD-MM-YYYY if needed, but standardize on ISO
      let date = new Date(dateString);
      if (isNaN(date.getTime())) {
        date = parse(dateString, 'dd-MM-yyyy', new Date());
      }
      if (isNaN(date.getTime())) return "—";
      return format(date, 'dd-MM-yyyy');
    } catch {
      return "—";
    }
  };

  // Calendar functions
  const navigateCalendar = (direction: number) => {
    const newDate = new Date(currentDate);
    if (calendarView === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (calendarView === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setCurrentDate(newDate);
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const getLeaveForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarLeaveApplications.filter(app => {
      const fromDate = new Date(app.fromDate);
      const toDate = new Date(app.toDate);
      const checkDate = new Date(dateStr);
      return checkDate >= fromDate && checkDate <= toDate;
    });
  };

  // Get leave type color mapping (returns hex colors for timeline calendar)
  const getLeaveTypeColor = (leaveType: string): string => {
    const colors: { [key: string]: string } = {
      'Paid Leave': '#3b82f6',      // Blue
      'Sick Leave': '#ef4444',      // Red
      'Casual Leave': '#f59e0b',    // Amber
      'Annual Leave': '#10b981',    // Green
      'Unpaid Leave': '#6b7280'     // Gray
    };
    return colors[leaveType] || '#8b5cf6'; // Default purple
  };

  // Get employee initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get avatar color based on employee name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Check if employee has leave on a specific date
  const getEmployeeLeaveForDate = (employeeName: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarLeaveApplications.find(app => {
      if (`${app.employeeCode} - ${app.employeeName}` !== employeeName && app.employeeName !== employeeName) return false;
      const fromDate = new Date(app.fromDate);
      const toDate = new Date(app.toDate);
      const checkDate = new Date(dateStr);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate >= fromDate && checkDate <= toDate;
    });
  };

  // Render Team Time Off Calendar (Timeline View)
  const renderTeamTimeOffCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate array of dates for the month
    const monthDates: Date[] = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      date.setHours(0, 0, 0, 0);
      return date;
    });

    // Get weekday abbreviations
    const weekdayAbbr = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    // Use all employees from employeeOptions
    const employees = employeeOptions;

    // State for tooltip
    const [hoveredLeave, setHoveredLeave] = React.useState<{
      leave: LeaveApplication;
      x: number;
      y: number;
    } | null>(null);

    // Get all leaves for an employee
    const getEmployeeLeavesForMonth = (employee: any) => {
      const employeeName = employee.employee_name;
      const employeeCode = employee.code;
      return calendarLeaveApplications.filter(app => (app.employeeCode === employeeCode && app.employeeName === employeeName) || app.employeeName === employeeName);
    };

    // Check if a date is within a leave range
    const isDateInLeave = (leave: LeaveApplication, date: Date) => {
      const fromDate = new Date(leave.fromDate);
      const toDate = new Date(leave.toDate);
      const checkDate = new Date(date);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate >= fromDate && checkDate <= toDate;
    };

    // Check if date is start of leave
    const isLeaveStart = (leave: LeaveApplication, date: Date) => {
      const fromDate = new Date(leave.fromDate);
      const checkDate = new Date(date);
      fromDate.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return fromDate.getTime() === checkDate.getTime();
    };

    // Check if date is end of leave
    const isLeaveEnd = (leave: LeaveApplication, date: Date) => {
      const toDate = new Date(leave.toDate);
      const checkDate = new Date(date);
      toDate.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return toDate.getTime() === checkDate.getTime();
    };

    return (
      <div className="space-y-4">
        {/* Calendar Container - Full width with better spacing */}
        <div className="border rounded-xl bg-white overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <div className="min-w-full" style={{ marginRight: '20px' }}>
              {/* Header Row - Weekdays */}
              <div className="flex bg-gray-50 border-b sticky top-0 z-30">
                {/* Empty cell for employee column */}
                <div className="w-56 flex-shrink-0 border-r bg-gray-50"></div>

                {/* Weekday headers */}
                {monthDates.map((date, index) => {
                  const dayOfWeek = weekdayAbbr[date.getDay()];
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = date.toDateString() === today.toDateString();
                  const isLastCell = index === monthDates.length - 1;
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex-1 min-w-[44px] text-center py-2 text-xs font-semibold border-r",
                        isWeekend && "bg-red-50",
                        isToday && "bg-blue-100",
                        isWeekend ? "text-red-600" : "text-gray-600"
                      )}
                    >
                      {dayOfWeek}
                    </div>
                  );
                })}
                {/* Spacer for scrollbar */}
                <div className="w-8 flex-shrink-0 bg-gray-50"></div>
              </div>

              {/* Header Row - Date Numbers */}
              <div className="flex border-b bg-gray-50 sticky top-[41px] z-30">
                {/* Employee column header */}
                <div className="w-56 flex-shrink-0 border-r px-4 py-3 bg-gray-50">
                  <span className="text-sm font-bold text-gray-700">Employee</span>
                </div>

                {/* Date numbers */}
                {monthDates.map((date, index) => {
                  const isToday = date.toDateString() === today.toDateString();
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isLastCell = index === monthDates.length - 1;
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex-1 min-w-[44px] text-center py-3 text-sm font-bold border-r",
                        isWeekend && "bg-red-50",
                        isToday && "bg-blue-100 text-blue-700",
                        !isToday && isWeekend && "text-red-600",
                        !isToday && !isWeekend && "text-gray-700"
                      )}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
                {/* Spacer for scrollbar */}
                <div className="w-8 flex-shrink-0 bg-gray-50"></div>
              </div>

              {/* Employee Rows */}
              {employees.map((employee: any, empIndex) => {
                const employeeLeaves = getEmployeeLeavesForMonth(employee);

                return (
                  <div key={empIndex} className="flex border-b hover:bg-gray-50 transition-colors">
                    {/* Employee Info Column - Sticky */}
                    <div className="w-56 flex-shrink-0 border-r px-4 py-4 flex items-center gap-3 bg-white sticky left-0 z-10">
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: getAvatarColor(employee.employee_name) }}
                      >
                        {getInitials(employee.employee_name)}
                      </div>
                      {/* Employee Name */}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {employee.employee_name}
                      </span>
                    </div>

                    {/* Date Cells with Leave Pills */}
                    {monthDates.map((date, dateIndex) => {
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = date.toDateString() === today.toDateString();
                      const isLastCell = dateIndex === monthDates.length - 1;

                      // Find if this date has any leave
                      const activeLeave = employeeLeaves.find(leave => isDateInLeave(leave, date));
                      const isStart = activeLeave && isLeaveStart(activeLeave, date);
                      const isEnd = activeLeave && isLeaveEnd(activeLeave, date);

                      return (
                        <div
                          key={dateIndex}
                          className={cn(
                            "flex-1 min-w-[44px] h-16 border-r flex items-center justify-center relative",
                            isWeekend && "bg-gray-50",
                            isToday && "bg-blue-50"
                          )}
                        >
                          {activeLeave && (
                            <div
                              className={cn(
                                "absolute inset-y-2 left-1 right-1 flex items-center justify-center cursor-pointer transition-all hover:opacity-90",
                                isStart && "rounded-l-full",
                                isEnd && "rounded-r-full",
                                !isStart && !isEnd && "rounded-none"
                              )}
                              style={{
                                backgroundColor: getLeaveTypeColor(activeLeave.leaveType),
                                opacity: 0.85
                              }}
                              onMouseEnter={(e) => {
                                setHoveredLeave({
                                  leave: activeLeave,
                                  x: e.clientX,
                                  y: e.clientY
                                });
                              }}
                              onMouseLeave={() => setHoveredLeave(null)}
                            >
                              {/* Show date number on start and end */}
                              {(isStart || isEnd) && (
                                <span className="text-white text-xs font-bold">
                                  {date.getDate()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Spacer for scrollbar */}
                    <div className="w-8 flex-shrink-0 h-16 bg-white"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredLeave && (
          <div
            className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-sm"
            style={{
              left: hoveredLeave.x + 15,
              top: hoveredLeave.y + 15,
              pointerEvents: 'none'
            }}
          >
            <div className="space-y-3 text-sm">
              <div className="font-bold text-base border-b pb-2 text-gray-900">
                {`${hoveredLeave.leave.employeeCode} - ${hoveredLeave.leave.employeeName}`}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <span className="text-gray-600 font-medium">Leave Type:</span>
                <span className="font-semibold text-gray-900">{hoveredLeave.leave.leaveType}</span>

                <span className="text-gray-600 font-medium">From Date:</span>
                <span className="text-gray-900">{formatDateTime(hoveredLeave.leave.fromDate)}</span>

                <span className="text-gray-600 font-medium">To Date:</span>
                <span className="text-gray-900">{formatDateTime(hoveredLeave.leave.toDate)}</span>

                <span className="text-gray-600 font-medium">Paid Leave:</span>
                <span className="text-gray-900">{hoveredLeave.leave.paidLeave ? 'Yes' : 'No'}</span>
              </div>
              {hoveredLeave.leave.remark && (
                <div className="pt-2 border-t">
                  <span className="text-gray-600 font-medium">Remark:</span>
                  <p className="mt-1 text-gray-900">{hoveredLeave.leave.remark}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    const today = new Date();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayDate = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: dayDate, isCurrentMonth: false, isToday: false, leaves: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const isToday = dayDate.toDateString() === today.toDateString();
      const leaves = getLeaveForDate(dayDate);
      days.push({ date: dayDate, isCurrentMonth: true, isToday, leaves });
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const dayDate = new Date(year, month + 1, day);
      days.push({ date: dayDate, isCurrentMonth: false, isToday: false, leaves: [] });
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="bg-white">
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center font-medium text-gray-600 bg-gray-50">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <div
              key={index}
              className={cn(
                "min-h-[120px] p-2 border-r border-b relative",
                !day.isCurrentMonth && "bg-gray-50 text-gray-400",
                day.isToday && "bg-blue-50"
              )}
            >
              <div className={cn("text-sm font-medium mb-1", day.isToday && "text-blue-600")}>
                {day.date.getDate()}
              </div>
              <div className="space-y-1">
                {day.leaves.slice(0, 3).map((leave, leaveIndex) => (
                  <div key={leaveIndex} className="text-xs px-2 py-1 rounded text-center font-medium bg-green-100 text-green-700">
                    {leave.leaveType}
                  </div>
                ))}
                {day.leaves.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">+{day.leaves.length - 3} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = getWeekStart(currentDate);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      weekDays.push(day);
    }
    const today = new Date();
    const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="bg-white">
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day, index) => {
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={index} className={cn("p-4 text-center border-r", isToday && "bg-blue-50")}>
                <div className="text-sm font-medium text-gray-600">{weekDayNames[day.getDay()]}</div>
                <div className={cn("text-2xl font-bold mt-1", isToday ? "text-blue-600" : "text-gray-900")}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDays.map((day, index) => {
            const leaves = getLeaveForDate(day);
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={index} className={cn("p-3 border-r", isToday && "bg-blue-50")}>
                <div className="space-y-2">
                  {leaves.map((leave, leaveIndex) => (
                    <div key={leaveIndex} className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-700">
                      {leave.leaveType}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-muted-foreground text-sm">Manage employee leave requests and holidays.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {!visibleTabs.find(t => t.id === activeTab) ? (
          <div className="flex-1 flex items-center justify-center mt-6">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">You don't have access to this module.</p>
            </div>
          </div>
        ) : (
          <>
        {/* Leave Entry Tab */}
        <TabsContent value="leave-entry" className="flex-1 space-y-6 mt-6">
          <AppListToolbar
            search={{
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: "Search employees..."
            }}
            filters={[
              {
                type: 'date',
                label: 'From Date',
                value: dateRangeFrom ? format(dateRangeFrom, "yyyy-MM-dd") : "",
                onChange: (val) => {
                  if (val) {
                    setDateRangeFrom(new Date(val));
                  } else {
                    setDateRangeFrom(undefined);
                  }
                }
              },
              {
                type: 'date',
                label: 'To Date',
                value: dateRangeTo ? format(dateRangeTo, "yyyy-MM-dd") : "",
                minDate: dateRangeFrom,
                onChange: (val) => {
                  if (val) {
                    setDateRangeTo(new Date(val));
                  } else {
                    setDateRangeTo(undefined);
                  }
                }
              }
            ]}
            actions={canCreate(leaveEntryModuleName) ? [
              {
                label: 'Add Leave',
                icon: <Plus className="h-4 w-4" />,
                onClick: () => {
                  resetForm();
                  setIsAddEditModalOpen(true);
                },
                variant: 'default'
              }
            ] : []}
          />

          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="rounded-md border mb-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>From Date</TableHead>
                      <TableHead>To Date</TableHead>
                      <TableHead>Paid Leave</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLeavesLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                      ) : paginatedLeaveEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">
                          <div className="flex flex-col items-center justify-center">
                            <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No leave entries found</p>
                            <p className="text-sm">Click "Add Leave" to create a new entry</p>
                          </div>
                        </TableCell>
                      </TableRow>
                      ) : (
                      paginatedLeaveEntries.map((app, index) => (
                        <TableRow key={app.id || index} className="hover:bg-muted/50 transition-colors border-b">
                          <TableCell className="font-medium py-3">{app.code || 'N/A'}</TableCell>
                          <TableCell className="py-3">
                            {typeof app.employee_name === 'object' && app.employee_name !== null 
                              ? (app.employee_name as any).employee_name 
                              : app.employee_name}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="font-normal bg-blue-50 text-blue-700 border-blue-200">
                              {typeof app.leave_type_name === 'object' && app.leave_type_name !== null 
                                ? (app.leave_type_name as any).leave_type_name 
                                : app.leave_type_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">{formatDateTime(app.from_date)}</TableCell>
                          <TableCell className="py-3">{formatDateTime(app.to_date)}</TableCell>
                          <TableCell className="py-3">
                            <Badge variant={app.is_paid_leave ? "default" : "secondary"} className="font-normal text-[11px] h-5">
                              {app.is_paid_leave ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <TableActionButtons
                              onView={() => handleViewLeave(app)}
                              onEdit={canEdit(leaveEntryModuleName) ? () => handleEditLeave(app) : undefined}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {!isLeavesLoading && (
                <DataTablePagination
                  currentPage={leaveEntryCurrentPage}
                  totalPages={leaveEntryTotalPages}
                  totalItems={totalLeaves}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setLeaveEntryCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  options={[10, 15, 30, 50]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab - Leave Calendar */}
        <TabsContent value="calendar" className="flex-1 mt-6">
          <div className="space-y-6" style={{ marginRight: '16px' }}>
            {/* Header with Month Navigation */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-2xl font-bold text-gray-800">Leave Calendar</h2>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigateCalendar(-1)} className="h-10 w-10">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-xl font-bold min-w-[200px] text-center text-gray-800">
                  {format(currentDate, 'MMMM yyyy')}
                </h3>
                <Button variant="outline" size="icon" onClick={() => navigateCalendar(1)} className="h-10 w-10">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Team Timeline Calendar - Full Width */}
            <div className="w-full">
              <ImprovedLeaveCalendar
                currentDate={currentDate}
                leaveApplications={calendarLeaveApplications}
                employees={calendarEmployees}
                leaveTypeColors={leaveTypeColors}
              />
            </div>

            {/* Legend */}
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-end gap-8">
                  {leaveTypeOptions.map((leaveType: any) => {
                    // Extract name string safely for label display
                    const typeName = typeof leaveType.leave_type_name === 'object' && leaveType.leave_type_name !== null
                      ? leaveType.leave_type_name.leave_type_name
                      : String(leaveType.leave_type_name || '');

                    return (
                      <div key={typeName} className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full shadow-sm"
                          style={{ backgroundColor: getLeaveTypeColor(typeName) }}
                        />
                        <span className="text-sm font-medium text-gray-700">{typeName}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        </>
        )}
      </Tabs>

      {/* Add/Edit Leave Modal */}
      <Dialog open={isAddEditModalOpen} onOpenChange={(open) => {
        // Allow closing via X button, Cancel, or Save
        setIsAddEditModalOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent
          className="w-[95%] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl md:min-h-[70vh] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => {
          // Prevent closing when clicking outside, but allow X button
          e.preventDefault();
        }}>
          <DialogHeader className="space-y-2 pb-2">
            <DialogTitle>{editingLeave ? "Edit Leave" : "Add Leave"}</DialogTitle>
            <DialogDescription>
              {editingLeave ? "Update the leave entry details" : "Fill in the details to create a new leave entry"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 md:gap-x-8">
              <div className="space-y-2">
                <Label htmlFor="employee" className="text-sm font-medium">EMPLOYEE <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  placeholder="Select Employee"
                  value={formData.employee_id}
                  options={(employeeOptions as any[]).map(e => ({ label: `${e.code} - ${e.employee_name}`, value: String(e.id) }))}
                  onChange={(val) => handleInputChange('employee_id', val)}
                />
                {formErrors.employee_id && <p className="text-xs text-red-500">{formErrors.employee_id}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveType" className="text-sm font-medium">LEAVE TYPE <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  placeholder="Select Leave Type"
                  value={formData.leave_type_id}
                  options={(leaveTypeOptions as any[]).map(lt => ({ label: lt.leave_type_name, value: String(lt.id) }))}
                  onChange={(val) => handleInputChange('leave_type_id', val)}
                />
                {formErrors.leave_type_id && <p className="text-xs text-red-500">{formErrors.leave_type_id}</p>}
              </div>

              <div className="space-y-2">
                <Label>From Date <span className="text-red-500">*</span></Label>
                <LeaveFormDatePicker
                  date={formData.fromDate}
                  setDate={(date) => handleInputChange('fromDate', date)}
                  minDate={employeeJoiningDate}
                />
                {formErrors.fromDate && <p className="text-sm text-red-500">{formErrors.fromDate}</p>}
              </div>

              <div className="space-y-2">
                <Label>To Date <span className="text-red-500">*</span></Label>
                <LeaveFormDatePicker
                  date={formData.toDate}
                  setDate={(date) => handleInputChange('toDate', date)}
                  minDate={formData.fromDate}
                />
                {formErrors.toDate && <p className="text-sm text-red-500">{formErrors.toDate}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paidLeave"
                    checked={formData.paidLeave}
                    onCheckedChange={(checked) => handleInputChange('paidLeave', checked)}
                  />
                  <Label htmlFor="paidLeave" className="cursor-pointer">Paid Leave</Label>
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label>Remark</Label>
                <Textarea
                  placeholder="Enter remark..."
                  value={formData.remark}
                  onChange={(e) => handleInputChange('remark', e.target.value)}
                  rows={4}
                  className="min-h-[110px]"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="space-y-3 pt-3">
                  <Label htmlFor="attachment" className="text-sm font-medium">Attachment (Optional)</Label>
                  <Input
                    ref={fileInputRef}
                    id="attachment"
                    type="file"
                    className="h-9 cursor-pointer"
                    disabled={formData.attachments.length > 0 || formData.newFiles.length > 0}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        // Only allow one file total
                        const totalFiles = formData.attachments.length + formData.newFiles.length;
                        if (totalFiles >= 1) {
                          toast({ 
                            variant: "destructive", 
                            title: "File Limit", 
                            description: "Only one attachment is allowed. Please remove the existing attachment first." 
                          });
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                          return;
                        }
                        // Set the first file only
                        setFormData(prev => ({ 
                          ...prev, 
                          newFiles: [files[0]] 
                        }));
                        // Reset the file input
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }
                    }}
                  />
                  {formData.attachments && formData.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Existing Attachments:</p>
                      {formData.attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs bg-gray-50 p-2 rounded border">
                          <span
                            onClick={() => {
                              window.open(resolveFileUrl(att.file_url), '_blank');
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {att.file_name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (formData.id) {
                                // Call API to delete attachment from server
                                deleteAttachmentsMutation.mutate(formData.id);
                              } else {
                                // If no ID (new entry), just remove from local state
                                setFormData(prev => ({
                                  ...prev,
                                  attachments: prev.attachments.filter((_, i) => i !== idx)
                                }));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.newFiles && formData.newFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">New Files to Upload:</p>
                      {formData.newFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs bg-blue-50 p-2 rounded border border-blue-200">
                          <span className="text-blue-700 font-medium">
                            {file.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                newFiles: prev.newFiles.filter((_, i) => i !== idx)
                              }));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-6 flex justify-between items-center">
            {editingLeave && (
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteLeave(editingLeave.id)}
                    className={!canDelete(leaveEntryModuleName) ? "hidden" : ""}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this leave record?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmDelete}
                      loading={isSubmitting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={!formData.employee_id || !formData.leave_type_id || !formData.fromDate || !formData.toDate || Object.keys(formErrors).length > 0 || (!canCreate(leaveEntryModuleName) && !canEdit(leaveEntryModuleName))}
                className="disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Leave Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="w-[95%] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl md:min-h-[70vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2 pb-2">
            <DialogTitle>Leave Details</DialogTitle>
            <DialogDescription>View complete details of the leave entry</DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 md:gap-x-8">
                <div className="space-y-2">
                  <Label>Employee Code</Label>
                  <Input value={selectedApplication.employee_code || selectedApplication.code} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Employee Name</Label>
                  <Input value={selectedApplication.employee_name} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Input value={selectedApplication.leave_type_name} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input value={formatDateTime(selectedApplication.from_date)} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input value={formatDateTime(selectedApplication.to_date)} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Paid Leave</Label>
                  <Input value={selectedApplication.is_paid_leave ? 'Yes' : 'No'} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input
                    value={`${selectedApplication.duration} days`}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Remark</Label>
                  <Textarea value={selectedApplication.remarks} disabled className="bg-muted" rows={3} />
                </div>
                {selectedApplication.attachments && selectedApplication.attachments.length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Attachments</Label>
                    <div className="mt-2 space-y-1">
                      {selectedApplication.attachments.map((att: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs bg-blue-50 p-2 rounded border border-blue-100">
                          <span
                            onClick={() => {
                              window.open(resolveFileUrl(att.file_url), '_blank');
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer italic"
                          >
                            {att.file_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-6">
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
