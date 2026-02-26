import React, { useState, useEffect } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInputBorderless, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, Edit, ChevronsUpDown, Check, ChevronDown, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import ImprovedLeaveCalendar from "@/components/hrms/ImprovedLeaveCalendar";

// Tabs configuration - Only 3 tabs: Dashboard, Leave Entry, Calendar
const tabsConfig = [
  { id: "dashboard", label: "Dashboard", roles: ["ADMIN", "HR", "EMPLOYEE"] },
  { id: "leave-entry", label: "Leave Entry", roles: ["ADMIN", "HR"] },
  { id: "calendar", label: "Calendar", roles: ["ADMIN", "HR", "EMPLOYEE"] }
];

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

// Date Picker Component - Same as Attendance page
function DatePicker({ date, setDate, disabled = false, minDate }: {
  date?: Date,
  setDate: (d?: Date) => void,
  disabled?: boolean,
  minDate?: Date
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
  const [visibleDate, setVisibleDate] = useState(() => date || new Date());

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

    // Check if date is before minDate
    if (minDate) {
      const minimum = new Date(minDate);
      minimum.setHours(0, 0, 0, 0);
      if (selected < minimum) {
        return; // Don't select dates before minDate
      }
    }

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
    const today = new Date();

    // Set minimum date
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
      const isPast = minimumDate ? dayDate < minimumDate : false;
      days.push({
        date: dayDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isPast
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      currentDate.setHours(0, 0, 0, 0);
      const isToday = new Date().toDateString() === currentDate.toDateString();
      const isSelected = date && currentDate.toDateString() === date.toDateString();
      const isPast = minimumDate ? currentDate < minimumDate : false;

      days.push({
        date: currentDate,
        isCurrentMonth: true,
        isToday,
        isSelected,
        isPast
      });
    }

    // Next month's leading days
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const dayDate = new Date(year, month + 1, day);
      dayDate.setHours(0, 0, 0, 0);
      const isPast = minimumDate ? dayDate < minimumDate : false;
      days.push({
        date: dayDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isPast
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

export default function LeaveManagement() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Calendar state
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Leave Entry Form State
  const [formData, setFormData] = useState({
    employee: "",
    leaveType: "",
    fromDate: undefined as Date | undefined,
    toDate: undefined as Date | undefined,
    paidLeave: true,
    remark: "",
    attachment: null as File | null
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveApplication | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leaveToDelete, setLeaveToDelete] = useState<string | null>(null);

  // Leave Entry Tab State - Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeFrom, setDateRangeFrom] = useState<Date | undefined>(undefined);
  const [dateRangeTo, setDateRangeTo] = useState<Date | undefined>(undefined);

  // Pagination State
  const [leaveEntryCurrentPage, setLeaveEntryCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Define the leave application type
  type LeaveApplication = {
    id: string;
    employee: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    paidLeave: boolean;
    remark: string;
    attachment?: File | null;
  };

  // Leave Applications State - Mock data
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([
    {
      id: "leave_001",
      employee: "John Doe",
      leaveType: "Paid Leave",
      fromDate: "2026-02-15",
      toDate: "2026-02-17",
      paidLeave: true,
      remark: "Family vacation"
    },
    {
      id: "leave_002",
      employee: "Jane Smith",
      leaveType: "Sick Leave",
      fromDate: "2026-02-20",
      toDate: "2026-02-21",
      paidLeave: true,
      remark: "Medical appointment"
    }
  ]);

  // Configuration
  const leaveTypeOptions = ['Paid Leave', 'Sick Leave', 'Casual Leave', 'Annual Leave', 'Unpaid Leave'];
  const employeeOptions = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams', 'David Brown'];

  // Mock holidays data
  const upcomingHolidays = [
    { name: "Independence Day", date: "2026-08-15", day: "Saturday" },
    { name: "Gandhi Jayanti", date: "2026-10-02", day: "Friday" },
    { name: "Diwali", date: "2026-11-01", day: "Sunday" }
  ];

  // Set initial tab based on URL
  useEffect(() => {
    if (location === '/hrms/leave-management/leave-entry') {
      setActiveTab('leave-entry');
    } else if (location === '/hrms/leave-management/calendar') {
      setActiveTab('calendar');
    } else if (location === '/hrms/leave-management/dashboard') {
      setActiveTab('dashboard');
    } else if (location === '/hrms/leave-management') {
      setLocation('/hrms/leave-management/dashboard');
    } else {
      setActiveTab('dashboard');
    }
  }, [location, setLocation]);

  // Handle tab changes with URL routing
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/hrms/leave-management/${value}`);
  };

  const visibleTabs = tabsConfig;

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
    if (!formData.employee) errors.employee = "Employee is required";
    if (!formData.leaveType) errors.leaveType = "Leave Type is required";
    if (!formData.fromDate) errors.fromDate = "From Date is required";
    if (!formData.toDate) errors.toDate = "To Date is required";

    // Validate From Date is not in the past
    if (formData.fromDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDate = new Date(formData.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      
      if (fromDate < today) {
        errors.fromDate = "From Date cannot be in the past";
      }
    }

    // Validate To Date is not before From Date
    if (formData.fromDate && formData.toDate) {
      const fromDate = new Date(formData.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(formData.toDate);
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
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // If From Date changes and To Date becomes invalid, clear To Date
      if (field === 'fromDate' && value && newData.toDate) {
        const fromDate = new Date(value);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(newData.toDate);
        toDate.setHours(0, 0, 0, 0);
        
        if (toDate < fromDate) {
          newData.toDate = undefined;
        }
      }
      
      return newData;
    });
    
    // Clear errors for the changed field
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      employee: "",
      leaveType: "",
      fromDate: undefined,
      toDate: undefined,
      paidLeave: true,
      remark: "",
      attachment: null
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

    if (editingLeave) {
      setLeaveApplications(prev =>
        prev.map(app =>
          app.id === editingLeave.id
            ? {
              ...app,
              employee: formData.employee,
              leaveType: formData.leaveType,
              fromDate: formData.fromDate ? format(formData.fromDate, 'yyyy-MM-dd') : '',
              toDate: formData.toDate ? format(formData.toDate, 'yyyy-MM-dd') : '',
              paidLeave: formData.paidLeave,
              remark: formData.remark,
              attachment: formData.attachment
            }
            : app
        )
      );
      toast({
        title: "Leave Updated Successfully",
        description: "The leave entry has been updated.",
        className: "bg-green-50 border-green-200 text-green-900"
      });
    } else {
      const newLeave: LeaveApplication = {
        id: `leave_${Date.now()}`,
        employee: formData.employee,
        leaveType: formData.leaveType,
        fromDate: formData.fromDate ? format(formData.fromDate, 'yyyy-MM-dd') : '',
        toDate: formData.toDate ? format(formData.toDate, 'yyyy-MM-dd') : '',
        paidLeave: formData.paidLeave,
        remark: formData.remark,
        attachment: formData.attachment
      };
      setLeaveApplications(prev => [newLeave, ...prev]);
      toast({
        title: "Leave Added Successfully",
        description: "The leave entry has been created.",
        className: "bg-green-50 border-green-200 text-green-900"
      });
    }
    resetForm();
    setIsAddEditModalOpen(false);
  };

  // Handle view leave details
  const handleViewLeave = (application: LeaveApplication) => {
    setSelectedApplication(application);
    setIsViewModalOpen(true);
  };

  // Handle edit leave
  const handleEditLeave = (application: LeaveApplication) => {
    setEditingLeave(application);
    setFormData({
      employee: application.employee,
      leaveType: application.leaveType,
      fromDate: new Date(application.fromDate),
      toDate: new Date(application.toDate),
      paidLeave: application.paidLeave,
      remark: application.remark,
      attachment: application.attachment || null
    });
    setIsAddEditModalOpen(true);
  };

  // Handle delete leave
  const handleDeleteLeave = (leaveId: string) => {
    setLeaveToDelete(leaveId);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (leaveToDelete) {
      setLeaveApplications(prev => prev.filter(app => app.id !== leaveToDelete));
      toast({
        title: "Leave Deleted Successfully",
        description: "The leave entry has been removed.",
        className: "bg-green-50 border-green-200 text-green-900"
      });
      setLeaveToDelete(null);
      setIsDeleteDialogOpen(false);
      setIsViewModalOpen(false);
    }
  };

  // Filter applications
  const filteredApplications = leaveApplications.filter(app => {
    const searchMatch = searchQuery === "" ||
      app.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.leaveType.toLowerCase().includes(searchQuery.toLowerCase());

    const dateMatch = (() => {
      if (!dateRangeFrom && !dateRangeTo) return true;
      const fromDate = new Date(app.fromDate);
      const toDate = new Date(app.toDate);
      let matchesFrom = true;
      let matchesTo = true;
      if (dateRangeFrom) {
        const filterFrom = new Date(dateRangeFrom);
        filterFrom.setHours(0, 0, 0, 0);
        matchesFrom = toDate >= filterFrom;
      }
      if (dateRangeTo) {
        const filterTo = new Date(dateRangeTo);
        filterTo.setHours(23, 59, 59, 999);
        matchesTo = fromDate <= filterTo;
      }
      return matchesFrom && matchesTo;
    })();

    return searchMatch && dateMatch;
  });

  // Pagination
  const leaveEntryTotalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const leaveEntryStartIndex = (leaveEntryCurrentPage - 1) * itemsPerPage;
  const leaveEntryEndIndex = leaveEntryStartIndex + itemsPerPage;
  const paginatedLeaveEntries = filteredApplications.slice(leaveEntryStartIndex, leaveEntryEndIndex);

  useEffect(() => {
    setLeaveEntryCurrentPage(1);
  }, [searchQuery, dateRangeFrom, dateRangeTo]);

  // Format date for display
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
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
    return leaveApplications.filter(app => {
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
    return leaveApplications.find(app => {
      if (app.employee !== employeeName) return false;
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
        const getEmployeeLeavesForMonth = (employeeName: string) => {
          return leaveApplications.filter(app => app.employee === employeeName);
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
                <div className="min-w-full">
                  {/* Header Row - Weekdays */}
                  <div className="flex bg-gray-50 border-b sticky top-0 z-30">
                    {/* Empty cell for employee column */}
                    <div className="w-56 flex-shrink-0 border-r bg-gray-50"></div>

                    {/* Weekday headers */}
                    {monthDates.map((date, index) => {
                      const dayOfWeek = weekdayAbbr[date.getDay()];
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = date.toDateString() === today.toDateString();
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
                  </div>

                  {/* Employee Rows */}
                  {employees.map((employee, empIndex) => {
                    const employeeLeaves = getEmployeeLeavesForMonth(employee);

                    return (
                      <div key={empIndex} className="flex border-b hover:bg-gray-50 transition-colors">
                        {/* Employee Info Column - Sticky */}
                        <div className="w-56 flex-shrink-0 border-r px-4 py-4 flex items-center gap-3 bg-white sticky left-0 z-10">
                          {/* Avatar */}
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: getAvatarColor(employee) }}
                          >
                            {getInitials(employee)}
                          </div>
                          {/* Employee Name */}
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {employee}
                          </span>
                        </div>

                        {/* Date Cells with Leave Pills */}
                        {monthDates.map((date, dateIndex) => {
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          const isToday = date.toDateString() === today.toDateString();

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
                                    "absolute inset-y-2 inset-x-0 flex items-center justify-center cursor-pointer transition-all hover:opacity-90",
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
                    {hoveredLeave.leave.employee}
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

    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayDate = new Date(year, month - 1, prevMonth.getDate() - i);
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
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">Manage employee leave requests and holidays.</p>
        </div>
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

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="flex-1 space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leaves (This Month)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {leaveApplications.filter(app => {
                    const date = new Date(app.fromDate);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Leaves this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today on Leave</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {leaveApplications.filter(app => {
                    // Get today's date with time set to 00:00:00
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    // Parse from and to dates and set time to 00:00:00
                    const fromDate = new Date(app.fromDate);
                    fromDate.setHours(0, 0, 0, 0);
                    
                    const toDate = new Date(app.toDate);
                    toDate.setHours(0, 0, 0, 0);
                    
                    // Check if today is between from and to dates (inclusive)
                    return today >= fromDate && today <= toDate;
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Employees on leave today</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Holidays</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingHolidays.map((holiday, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">{holiday.day}</p>
                    </div>
                    <div className="text-sm font-medium">{formatDateTime(holiday.date)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Entry Tab */}
        <TabsContent value="leave-entry" className="flex-1 space-y-6 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-end gap-4">
                <div className="w-64 space-y-2">
                  <Label>Search</Label>
                  <Input
                    placeholder="Search by name, type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-48 space-y-2">
                  <Label>From Date</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DatePicker date={dateRangeFrom} setDate={setDateRangeFrom} />
                    </div>
                    {dateRangeFrom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDateRangeFrom(undefined)}
                        className="h-10 w-10 shrink-0"
                        title="Clear from date"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="w-48 space-y-2">
                  <Label>To Date</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DatePicker date={dateRangeTo} setDate={setDateRangeTo} />
                    </div>
                    {dateRangeTo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDateRangeTo(undefined)}
                        className="h-10 w-10 shrink-0"
                        title="Clear to date"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Button onClick={() => setIsAddEditModalOpen(true)} className="h-10 ml-auto">
                  <Plus className="mr-2 h-4 w-4" /> Add Leave
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-6 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                <div>Employee</div>
                <div>Leave Type</div>
                <div>From Date</div>
                <div>To Date</div>
                <div>Paid Leave</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="space-y-0">
                {paginatedLeaveEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No leave entries found</p>
                    <p className="text-sm">Click "Add Leave" to create a new entry</p>
                  </div>
                ) : (
                  paginatedLeaveEntries.map((application) => (
                    <div key={application.id} className="grid grid-cols-6 gap-4 p-4 border-b hover:bg-muted/20 transition-colors">
                      <div className="text-sm">{application.employee}</div>
                      <div className="text-sm">{application.leaveType}</div>
                      <div className="text-sm">{formatDateTime(application.fromDate)}</div>
                      <div className="text-sm">{formatDateTime(application.toDate)}</div>
                      <div className="text-sm">
                        <Badge variant={application.paidLeave ? "default" : "secondary"}>
                          {application.paidLeave ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleViewLeave(application)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditLeave(application)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
                <div className="text-sm text-gray-600">
                  Showing {filteredApplications.length === 0 ? 0 : leaveEntryStartIndex + 1} to {Math.min(leaveEntryEndIndex, filteredApplications.length)} of {filteredApplications.length} entries
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaveEntryCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={leaveEntryCurrentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaveEntryCurrentPage(prev => Math.min(leaveEntryTotalPages, prev + 1))}
                    disabled={leaveEntryCurrentPage >= leaveEntryTotalPages || leaveEntryTotalPages === 0}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab - Team Time Off Calendar */}
        <TabsContent value="calendar" className="flex-1 mt-6">
          <div className="space-y-6">
            {/* Header with Month Navigation */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-2xl font-bold text-gray-800">Team Time Off Calendar</h2>
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
                leaveApplications={leaveApplications}
                employees={employeeOptions}
                leaveTypeColors={leaveTypeOptions.reduce((acc, type) => {
                  acc[type] = getLeaveTypeColor(type);
                  return acc;
                }, {} as { [key: string]: string })}
              />
            </div>

            {/* Legend */}
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-end gap-8">
                  {leaveTypeOptions.map((leaveType) => (
                    <div key={leaveType} className="flex items-center gap-2">
                      <div 
                        className="w-5 h-5 rounded-full shadow-sm" 
                        style={{ backgroundColor: getLeaveTypeColor(leaveType) }}
                      />
                      <span className="text-sm font-medium text-gray-700">{leaveType}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Leave Modal */}
      <Dialog open={isAddEditModalOpen} onOpenChange={setIsAddEditModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLeave ? "Edit Leave" : "Add Leave"}</DialogTitle>
            <DialogDescription>
              {editingLeave ? "Update the leave entry details" : "Fill in the details to create a new leave entry"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SearchableSelect
                label="Employee"
                value={formData.employee}
                options={employeeOptions}
                onChange={(value) => handleInputChange('employee', value)}
                required
              />
              {formErrors.employee && <p className="text-sm text-red-500 col-span-2">{formErrors.employee}</p>}

              <SearchableSelect
                label="Leave Type"
                value={formData.leaveType}
                options={leaveTypeOptions}
                onChange={(value) => handleInputChange('leaveType', value)}
                required
              />
              {formErrors.leaveType && <p className="text-sm text-red-500 col-span-2">{formErrors.leaveType}</p>}

              <div className="space-y-2">
                <Label>From Date <span className="text-red-500">*</span></Label>
                <DatePicker
                  date={formData.fromDate}
                  setDate={(date) => handleInputChange('fromDate', date)}
                  minDate={new Date()}
                />
                {formErrors.fromDate && <p className="text-sm text-red-500">{formErrors.fromDate}</p>}
              </div>

              <div className="space-y-2">
                <Label>To Date <span className="text-red-500">*</span></Label>
                <DatePicker
                  date={formData.toDate}
                  setDate={(date) => handleInputChange('toDate', date)}
                  minDate={formData.fromDate || new Date()}
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

              <div className="space-y-2 md:col-span-2">
                <Label>Remark</Label>
                <Textarea
                  placeholder="Enter remark..."
                  value={formData.remark}
                  onChange={(e) => handleInputChange('remark', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Attachment (Optional)</Label>
                <Input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleInputChange('attachment', file);
                  }}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                {formData.attachment && (
                  <p className="text-sm text-green-600">File selected: {formData.attachment.name}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.employee || !formData.leaveType || !formData.fromDate || !formData.toDate}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Leave Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leave Details</DialogTitle>
            <DialogDescription>View complete details of the leave entry</DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Input value={selectedApplication.employee} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Input value={selectedApplication.leaveType} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input value={formatDateTime(selectedApplication.fromDate)} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input value={formatDateTime(selectedApplication.toDate)} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Paid Leave</Label>
                  <Input value={selectedApplication.paidLeave ? 'Yes' : 'No'} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input 
                    value={`${calculateDuration(new Date(selectedApplication.fromDate), new Date(selectedApplication.toDate))} days`} 
                    disabled 
                    className="bg-muted" 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Remark</Label>
                  <Textarea value={selectedApplication.remark} disabled className="bg-muted" rows={3} />
                </div>
                {selectedApplication.attachment && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Attachment</Label>
                    <Input value={selectedApplication.attachment.name} disabled className="bg-muted" />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center">
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="mr-auto"
                  onClick={() => selectedApplication && handleDeleteLeave(selectedApplication.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the leave entry for {selectedApplication?.employee}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={confirmDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
