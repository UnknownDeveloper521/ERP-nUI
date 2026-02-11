import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import { Plus, Calendar, ChevronDown, ChevronUp, AlertTriangle, CalendarIcon, ChevronLeft, ChevronRight, Search, FileSpreadsheet, ShieldCheck, Eye, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Mock Data - Removed, using dynamic data only

// Mock Holidays - Removed, using dynamic data only

// Tabs configuration for future permission filtering
const tabsConfig = [
  { id: "dashboard", label: "Dashboard", roles: ["ADMIN", "HR", "EMPLOYEE"] },
  { id: "apply", label: "Apply Leave", roles: ["ADMIN", "HR", "EMPLOYEE"] },
  { id: "management", label: "Team Requests", roles: ["ADMIN", "HR"] },
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

export default function LeaveManagement() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expandedGroups, setExpandedGroups] = useState<{[key: string]: boolean}>({});
  
  // Calendar state
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'year'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Apply Leave Form State
  const [formData, setFormData] = useState({
    leaveType: "",
    fromDate: undefined as Date | undefined,
    toDate: undefined as Date | undefined,
    reason: "",
    halfDay: false,
    halfDaySession: "",
    attachment: null as File | null
  });
  
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  
  // Delete confirmation dialog state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<LeaveApplication | null>(null);
  
  // Management Tab State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("All");
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [managedApplication, setManagedApplication] = useState<any>(null);
  const [refusalReason, setRefusalReason] = useState("");
  const [showRefusalForm, setShowRefusalForm] = useState(false);
  const [refusalError, setRefusalError] = useState("");
  const [managementFormData, setManagementFormData] = useState({
    status: "",
    remarks: ""
  });

  // Pagination State
  const [managementCurrentPage, setManagementCurrentPage] = useState(1);
  const [applyCurrentPage, setApplyCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Define the leave application type
  type LeaveApplication = {
    id: string;
    requestId: string;
    employeeName: string;
    employeeId: string;
    department: string;
    manager: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    duration: string;
    status: string;
    appliedDate: string;
    appliedOn: string;
    reason: string;
    halfDay: boolean;
    halfDaySession: string;
    attachment: File | { name: string } | null;
    remarks: string;
    approvedOn: string | null;
    refusedOn: string | null;
    refusalReason: string | null;
    lastUpdatedOn: string;
  };

  // Leave Applications State - Start with ONE mock record to prevent runtime crashes
  // ⚠️ SAFE GUARD: Added ONE mock leave application to prevent runtime crashes
  // This ensures leave management never crashes when empty
  // ============================================================================
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([
    {
      id: "app_001",
      requestId: "LR-2026-001",
      employeeName: "John Doe",
      employeeId: "EMP001",
      department: "Engineering",
      manager: "Jane Smith",
      leaveType: "Paid",
      fromDate: "2026-02-15",
      toDate: "2026-02-17",
      duration: "3",
      status: "Pending",
      appliedDate: "2026-02-10",
      appliedOn: new Date().toISOString(),
      reason: "Family vacation",
      halfDay: false,
      halfDaySession: "",
      attachment: null,
      remarks: "Submitted for approval",
      approvedOn: null,
      refusedOn: null,
      refusalReason: null,
      lastUpdatedOn: new Date().toISOString()
    }
  ]);
  
  // Configuration
  const attachmentRequiredFor = ['Sick'];
  const leaveTypeOptions = ['Paid', 'Sick', 'Casual'];
  
  // Set initial tab based on URL
  useEffect(() => {
    if (location === '/hrms/leave-management/apply' || location === '/leave-management/apply') {
      setActiveTab('apply');
    } else if (location === '/hrms/leave-management/management') {
      setActiveTab('management');
    } else if (location === '/hrms/leave-management/calendar') {
      setActiveTab('calendar');
    } else if (location === '/hrms/leave-management/dashboard') {
      setActiveTab('dashboard');
    } else if (location === '/hrms/leave-management') {
      // Redirect to dashboard
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

  // For future: const userRole = "EMPLOYEE"; // This will come from auth context
  // const visibleTabs = tabsConfig.filter(tab => tab.roles.includes(userRole));
  const visibleTabs = tabsConfig; // Show all tabs for now

  // Calculate duration live
  const calculateDuration = (): string => {
    if (!formData.fromDate || !formData.toDate) return "0";
    
    const from = new Date(formData.fromDate);
    const to = new Date(formData.toDate);
    
    if (formData.halfDay) {
      return "0.5";
    }
    
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive count
    return diffDays.toString();
  };

  // Get all dates that are blocked due to existing leave applications
  const getBlockedDates = (): Date[] => {
    const blockedDates: Date[] = [];
    
    leaveApplications.forEach(app => {
      // Only block dates for Pending and Approved applications
      if (app.status === 'Pending' || app.status === 'Approved') {
        const fromDate = new Date(app.fromDate);
        const toDate = new Date(app.toDate);
        
        // Add all dates in the range
        const currentDate = new Date(fromDate);
        while (currentDate <= toDate) {
          blockedDates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });
    
    return blockedDates;
  };

  // Form validation - simplified since calendar prevents most invalid states
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    // Required field validation
    if (!formData.leaveType) errors.leaveType = "Leave Type is required";
    if (!formData.fromDate) errors.fromDate = "From Date is required";
    if (!formData.toDate) errors.toDate = "To Date is required";
    if (!formData.reason.trim()) errors.reason = "Reason is required";
    
    // Half day validation
    if (formData.halfDay && !formData.halfDaySession) {
      errors.halfDaySession = "Half Day Session is required when Half Day is enabled";
    }
    
    // Attachment validation
    if (attachmentRequiredFor.includes(formData.leaveType) && !formData.attachment) {
      errors.attachment = "Attachment is required for this leave type";
    }
    
    // Only validate dates if they somehow became invalid (shouldn't happen with calendar restrictions)
    if (formData.fromDate && formData.toDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const fromDate = new Date(formData.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = new Date(formData.toDate);
      toDate.setHours(0, 0, 0, 0);
      
      // These should rarely trigger due to calendar restrictions
      if (fromDate < today) {
        errors.fromDate = "From Date cannot be in the past";
      }
      if (toDate < today) {
        errors.toDate = "To Date cannot be in the past";
      }
      if (toDate < fromDate) {
        errors.toDate = "To Date must be greater than or equal to From Date";
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes with smart date logic
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Smart date handling
      if (field === 'fromDate' && value) {
        // If user changes fromDate and toDate is earlier than new fromDate, reset toDate to fromDate
        if (newData.toDate && new Date(newData.toDate) < new Date(value)) {
          newData.toDate = value;
        }
      }
      
      return newData;
    });
    
    // Clear specific field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleInputChange('attachment', file);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      leaveType: "",
      fromDate: undefined,
      toDate: undefined,
      reason: "",
      halfDay: false,
      halfDaySession: "",
      attachment: null
    });
    setFormErrors({});
    
    // Clear file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // Handle cancel
  const handleCancel = () => {
    resetForm();
    setActiveTab('dashboard');
    setLocation('/hrms/leave-management/dashboard');
  };

  // Handle submit
  const handleSubmit = () => {
    const isValid = validateForm();
    
    if (!isValid) {
      return; // Just return without showing error summary
    }
    
    // Create new leave application
    const newApplication = {
      id: `app_${Date.now()}`,
      requestId: `LR-2026-${String(leaveApplications.length + 1).padStart(3, '0')}`,
      employeeName: "Current User", // This would come from auth context
      employeeId: "EMP999",
      department: "—",
      manager: "—",
      leaveType: formData.leaveType,
      fromDate: formData.halfDay 
        ? (formData.fromDate ? format(formData.fromDate, 'yyyy-MM-dd') : '')
        : (formData.fromDate ? format(formData.fromDate, 'yyyy-MM-dd') : ''),
      toDate: formData.halfDay 
        ? (formData.fromDate ? format(formData.fromDate, 'yyyy-MM-dd') : '')
        : (formData.toDate ? format(formData.toDate, 'yyyy-MM-dd') : ''),
      duration: calculateDuration(),
      status: "Pending",
      appliedDate: new Date().toISOString().split('T')[0],
      appliedOn: new Date().toISOString(),
      reason: formData.reason,
      halfDay: formData.halfDay,
      halfDaySession: formData.halfDaySession,
      attachment: formData.attachment,
      remarks: "Submitted for approval",
      approvedOn: null as string | null,
      refusedOn: null as string | null,
      refusalReason: null as string | null,
      lastUpdatedOn: new Date().toISOString()
    };
    
    // Add to applications list
    setLeaveApplications(prev => [newApplication, ...prev]);
    
    // Show success toast message
    toast({
      title: "Leave Applied Successfully",
      description: "Your leave request has been submitted successfully.",
      className: "bg-green-50 border-green-200 text-green-900"
    });
    
    // Reset and close modal
    resetForm();
    setIsApplyModalOpen(false);
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    resetForm();
    setIsApplyModalOpen(false);
  };

  // Handle delete leave application - show confirmation dialog
  const handleDeleteLeave = (application: LeaveApplication) => {
    setAppToDelete(application);
    setIsDeleteOpen(true);
  };

  // Handle confirmed delete
  const handleConfirmDelete = () => {
    if (appToDelete) {
      setLeaveApplications(prev => prev.filter(app => app.id !== appToDelete.id));
      setIsViewModalOpen(false);
      setIsDeleteOpen(false);
      setAppToDelete(null);
      
      toast({
        title: "Leave Application Deleted",
        description: "Your leave application has been deleted successfully.",
        className: "bg-red-50 border-red-200 text-red-900"
      });
    }
  };

  // Handle view leave details
  const handleViewLeave = (application: any) => {
    setSelectedApplication(application);
    setIsViewModalOpen(true);
  };

  // Handle management leave details
  const handleManageLeave = (application: any) => {
    setManagedApplication(application);
    setManagementFormData({
      status: application.status,
      remarks: application.remarks || ""
    });
    setIsManageModalOpen(true);
    setShowRefusalForm(false);
    setRefusalReason("");
    setRefusalError("");
  };

  // Handle approve leave
  const handleApproveLeave = () => {
    if (!managedApplication) return;

    const now = new Date().toISOString();
    setLeaveApplications(prev => 
      prev.map(app => 
        app.id === managedApplication.id 
          ? { 
              ...app, 
              status: "Approved",
              approvedOn: now,
              lastUpdatedOn: now
            }
          : app
      )
    );

    toast({
      title: "Leave Application Approved",
      description: `Leave request ${managedApplication.requestId} has been approved successfully.`,
      className: "bg-green-50 border-green-200 text-green-900"
    });

    setIsManageModalOpen(false);
    setManagedApplication(null);
  };

  // Handle refuse leave - show refusal form
  const handleRefuseLeave = () => {
    setShowRefusalForm(true);
    setRefusalReason("");
    setRefusalError("");
  };

  // Handle confirm refusal
  const handleConfirmRefusal = () => {
    if (!refusalReason.trim()) {
      setRefusalError("Refusal reason is required");
      return;
    }

    if (!managedApplication) return;

    const now = new Date().toISOString();
    setLeaveApplications(prev => 
      prev.map(app => 
        app.id === managedApplication.id 
          ? { 
              ...app, 
              status: "Refused",
              refusedOn: now,
              refusalReason: refusalReason.trim(),
              lastUpdatedOn: now
            }
          : app
      )
    );

    toast({
      title: "Leave Application Refused",
      description: `Leave request ${managedApplication.requestId} has been refused.`,
      className: "bg-red-50 border-red-200 text-red-900"
    });

    setIsManageModalOpen(false);
    setManagedApplication(null);
    setShowRefusalForm(false);
    setRefusalReason("");
    setRefusalError("");
  };

  // Handle back from refusal form
  const handleBackFromRefusal = () => {
    setShowRefusalForm(false);
    setRefusalReason("");
    setRefusalError("");
  };

  // Handle management modal submit
  const handleManagementSubmit = () => {
    if (!managementFormData.status) {
      toast({
        title: "Status Required",
        description: "Please select a status for this leave application.",
        className: "bg-red-50 border-red-200 text-red-900"
      });
      return;
    }

    if (!managedApplication) return;

    const now = new Date().toISOString();
    setLeaveApplications(prev => 
      prev.map(app => 
        app.id === managedApplication.id 
          ? { 
              ...app, 
              status: managementFormData.status,
              remarks: managementFormData.remarks || app.remarks,
              lastUpdatedOn: now,
              ...(managementFormData.status === "Approved" && { approvedOn: now }),
              ...(managementFormData.status === "Refused" && { refusedOn: now })
            }
          : app
      )
    );

    toast({
      title: "Status Updated Successfully",
      description: `Leave request ${managedApplication.requestId} status has been updated.`,
      className: "bg-green-50 border-green-200 text-green-900"
    });

    setIsManageModalOpen(false);
    setManagedApplication(null);
    setManagementFormData({ status: "", remarks: "" });
  };

  // Filter applications based on search query and filters
  const filteredApplications = leaveApplications.filter(app => {
    // Enhanced search filter - searches across multiple fields
    const searchMatch = searchQuery === "" || 
      // Request ID search
      app.requestId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      // Employee name search
      (app.employeeName && app.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      // Employee ID search
      (app.employeeId && app.employeeId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      // Leave type search
      app.leaveType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      // Status search
      app.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      // Department search
      (app.department && app.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      // Manager search
      (app.manager && app.manager.toLowerCase().includes(searchQuery.toLowerCase())) ||
      // Reason search
      (app.reason && app.reason.toLowerCase().includes(searchQuery.toLowerCase()));

    // Status filter
    const statusMatch = statusFilter === "All" || app.status === statusFilter;

    // Leave type filter
    const leaveTypeMatch = leaveTypeFilter === "All" || app.leaveType === leaveTypeFilter;

    return searchMatch && statusMatch && leaveTypeMatch;
  });

  // Pagination for Management tab
  const managementTotalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const managementStartIndex = (managementCurrentPage - 1) * itemsPerPage;
  const managementEndIndex = managementStartIndex + itemsPerPage;
  const paginatedManagementApplications = filteredApplications.slice(managementStartIndex, managementEndIndex);

  // Pagination for Apply tab
  const applyTotalPages = Math.ceil(leaveApplications.length / itemsPerPage);
  const applyStartIndex = (applyCurrentPage - 1) * itemsPerPage;
  const applyEndIndex = applyStartIndex + itemsPerPage;
  const paginatedApplyApplications = leaveApplications.slice(applyStartIndex, applyEndIndex);

  // Reset pagination when filters change
  useEffect(() => {
    setManagementCurrentPage(1);
  }, [searchQuery, statusFilter, leaveTypeFilter]);

  // Reset pagination when apply list changes
  useEffect(() => {
    setApplyCurrentPage(1);
  }, [leaveApplications.length]);

  // Get status badge class with inventory-style colors
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'pending': return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'refused': 
      case 'rejected': return 'bg-red-100 text-red-700 hover:bg-red-100';
      case 'cancelled': return 'bg-orange-100 text-orange-700 hover:bg-orange-100';
      case 'draft': return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
      default: return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    }
  };

  // Format date for display
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "—";
    }
  };

  // Check if attachment warning should be shown
  const showAttachmentWarning = attachmentRequiredFor.includes(formData.leaveType) && !formData.attachment;

  // Check if form is valid for submit button state
  const isFormValidForSubmit = (): boolean => {
    // Check required fields
    const hasRequiredFields = Boolean(
      formData.leaveType &&
      formData.fromDate &&
      formData.toDate &&
      formData.reason.trim()
    );
    
    // Check half day session if half day is enabled
    const hasHalfDaySession = !formData.halfDay || Boolean(formData.halfDaySession);
    
    // Check attachment if required
    const hasRequiredAttachment = !attachmentRequiredFor.includes(formData.leaveType) || Boolean(formData.attachment);
    
    // Check if no validation errors exist
    const noValidationErrors = Object.keys(formErrors).length === 0;
    
    // Check dates are not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let validDates = true;
    if (formData.fromDate) {
      const fromDate = new Date(formData.fromDate);
      fromDate.setHours(0, 0, 0, 0);
      if (fromDate < today) validDates = false;
    }
    
    if (formData.toDate) {
      const toDate = new Date(formData.toDate);
      toDate.setHours(0, 0, 0, 0);
      if (toDate < today) validDates = false;
    }
    
    return hasRequiredFields && hasHalfDaySession && hasRequiredAttachment && noValidationErrors && validDates;
  };
  
  // Check if submit should be disabled
  const isSubmitDisabled = !isFormValidForSubmit() || showAttachmentWarning;

  // Calendar navigation function
  const navigateCalendar = (direction: number) => {
    const newDate = new Date(currentDate);
    
    if (calendarView === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (calendarView === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (calendarView === 'year') {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }
    
    setCurrentDate(newDate);
  };

  // Get week start function
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Get leave data for a specific date - using only actual leave applications
  const getLeaveForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Get actual leave applications for this date
    const actualLeaves = leaveApplications.filter(app => {
      const fromDate = new Date(app.fromDate);
      const toDate = new Date(app.toDate);
      const checkDate = new Date(dateStr);
      
      // Check if the date falls within the leave period
      return checkDate >= fromDate && checkDate <= toDate;
    }).map(app => ({
      date: dateStr,
      type: app.leaveType,
      title: `${app.leaveType} Leave`,
      status: app.status.toLowerCase()
    }));
    
    return actualLeaves;
  };

  // Get leave status color
  const getLeaveStatusColor = (status: string, type: string) => {
    if (type.toLowerCase().includes('holiday')) return 'bg-blue-100 text-blue-700';
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': 
      case 'refused': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Calendar rendering functions
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const today = new Date();
    
    // Previous month's trailing days
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayDate = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({
        date: dayDate,
        isCurrentMonth: false,
        isToday: false,
        leaves: []
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const isToday = dayDate.toDateString() === today.toDateString();
      const leaves = getLeaveForDate(dayDate);

      days.push({
        date: dayDate,
        isCurrentMonth: true,
        isToday,
        leaves
      });
    }

    // Next month's leading days
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const dayDate = new Date(year, month + 1, day);
      days.push({
        date: dayDate,
        isCurrentMonth: false,
        isToday: false,
        leaves: []
      });
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="bg-white">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center font-medium text-gray-600 bg-gray-50">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
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
              <div className={cn(
                "text-sm font-medium mb-1",
                day.isToday && "text-blue-600"
              )}>
                {day.date.getDate()}
              </div>
              
              {/* Leave items */}
              <div className="space-y-1">
                {day.leaves.slice(0, 3).map((leave, leaveIndex) => (
                  <div
                    key={leaveIndex}
                    className={cn(
                      "text-xs px-2 py-1 rounded text-center font-medium",
                      getLeaveStatusColor(leave.status, leave.type)
                    )}
                  >
                    {leave.title}
                  </div>
                ))}
                {day.leaves.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{day.leaves.length - 3} more
                  </div>
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
        {/* Week Header */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day, index) => {
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={index} className={cn(
                "p-4 text-center border-r",
                isToday && "bg-blue-50"
              )}>
                <div className="text-sm font-medium text-gray-600">
                  {weekDayNames[day.getDay()]}
                </div>
                <div className={cn(
                  "text-2xl font-bold mt-1",
                  isToday ? "text-blue-600" : "text-gray-900"
                )}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Week Content */}
        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDays.map((day, index) => {
            const leaves = getLeaveForDate(day);
            const isToday = day.toDateString() === today.toDateString();
            
            return (
              <div
                key={index}
                className={cn(
                  "p-3 border-r",
                  isToday && "bg-blue-50"
                )}
              >
                <div className="space-y-2">
                  {leaves.map((leave, leaveIndex) => (
                    <div
                      key={leaveIndex}
                      className={cn(
                        "text-xs px-2 py-1 rounded font-medium",
                        getLeaveStatusColor(leave.status, leave.type)
                      )}
                    >
                      {leave.title}
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

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = [];
    
    for (let month = 0; month < 12; month++) {
      months.push(new Date(year, month, 1));
    }

    return (
      <div className="bg-white p-6">
        <div className="grid grid-cols-3 gap-6">
          {months.map((month, index) => {
            const monthName = format(month, 'MMMM');
            const daysInMonth = new Date(year, month.getMonth() + 1, 0).getDate();
            // Get actual leave applications for this month
            const actualMonthLeaves = leaveApplications.filter(app => {
              const fromDate = new Date(app.fromDate);
              const toDate = new Date(app.toDate);
              return (fromDate.getFullYear() === year && fromDate.getMonth() === month.getMonth()) ||
                     (toDate.getFullYear() === year && toDate.getMonth() === month.getMonth());
            }).map(app => ({
              status: app.status.toLowerCase()
            }));
            
            const allMonthLeaves = actualMonthLeaves;

            return (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold text-center mb-3">{monthName}</h3>
                <div className="text-center text-sm text-gray-600">
                  <div>{daysInMonth} days</div>
                  <div className="mt-2">
                    {allMonthLeaves.length > 0 && (
                      <div className="text-xs">
                        <span className="text-green-600">{allMonthLeaves.filter(l => l.status === 'approved').length} approved</span>
                        {allMonthLeaves.filter(l => l.status === 'pending').length > 0 && (
                          <span className="text-yellow-600 ml-2">{allMonthLeaves.filter(l => l.status === 'pending').length} pending</span>
                        )}
                        {allMonthLeaves.filter(l => l.status === 'rejected' || l.status === 'refused').length > 0 && (
                          <span className="text-red-600 ml-2">{allMonthLeaves.filter(l => l.status === 'rejected' || l.status === 'refused').length} rejected</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Group leave requests by month
  const groupLeaveRequestsByMonth = (requests: LeaveApplication[]) => {
    const groups: {[key: string]: LeaveApplication[]} = {};
    
    requests.forEach(request => {
      const date = new Date(request.fromDate);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(request);
    });
    
    return groups;
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'default'; // green
      case 'pending': return 'secondary'; // blue
      case 'refused': return 'destructive'; // red
      case 'cancelled': return 'outline'; // orange
      case 'draft': return 'secondary'; // gray
      default: return 'secondary';
    }
  };

  const getLocationBadgeClass = (location: string) => {
    switch (location.toLowerCase()) {
      case 'india': return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'all': return 'bg-green-100 text-green-700 hover:bg-green-100';
      default: return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const recentRequests = leaveApplications.slice(0, 5);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">Manage employee leave requests and holidays.</p>
        </div>
      </div>

      {/* Tabs */}
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
          {/* First Row: Quick Actions Buttons */}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setLocation("/hrms/leave-management/apply")} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Apply Leave
            </Button>
            <Button variant="outline" onClick={() => setActiveTab("calendar")}>
              <Calendar className="mr-2 h-4 w-4" /> Calendar
            </Button>
          </div>

          {/* Second Row: KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Leave Balance Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leave Balance</CardTitle>
                <div className="h-4 w-4 text-muted-foreground">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin opacity-60"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Available</div>
                <p className="text-xs text-muted-foreground">As per policy</p>
              </CardContent>
            </Card>

            {/* Pending Requests Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                <div className="h-4 w-4 text-blue-500">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leaveApplications.filter(app => app.status === 'Pending').length}</div>
                <p className="text-xs text-muted-foreground">Awaiting Approval</p>
              </CardContent>
            </Card>

            {/* Approved This Month Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved This Month</CardTitle>
                <div className="h-4 w-4 text-green-500">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leaveApplications.filter(app => app.status === 'Approved' && new Date(app.appliedDate).getMonth() === new Date().getMonth()).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Two Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel: Recent Leave Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Recent Leave Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No recent leave requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <div>
                            <div className="font-medium text-sm">{request.leaveType}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(request.fromDate)} → {formatDate(request.toDate)}
                            </div>
                            <div className="text-xs text-muted-foreground">{request.duration} day{request.duration !== '1' ? 's' : ''}</div>
                          </div>
                        </div>
                        <Badge className={cn("text-xs", getStatusBadgeClass(request.status))}>
                          {request.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Panel: Upcoming Holidays */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Upcoming Holidays</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No holidays configured</p>
                  <p className="text-xs text-muted-foreground">Add holidays to see them here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Apply Leave Tab */}
        <TabsContent value="apply" className="flex-1 mt-6">
          <div className="space-y-6">
            {/* Apply Leave Button */}
            <div className="flex justify-end">
              <Button 
                onClick={() => setIsApplyModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" /> Apply Leave
              </Button>
            </div>

            {/* Leave Applications List */}
            <Card>
              <CardContent className="p-0">
                {/* Table Header */}
                <div className="grid grid-cols-8 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                  <div className="col-span-1">Request ID</div>
                  <div className="col-span-1">Leave Type</div>
                  <div className="col-span-1">From Date</div>
                  <div className="col-span-1">To Date</div>
                  <div className="col-span-1">Duration</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Applied Date</div>
                  <div className="col-span-1">Actions</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-0">
                  {paginatedApplyApplications.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No leave applications found</p>
                      <p className="text-sm">Click "Apply Leave" to submit your first leave request</p>
                    </div>
                  ) : (
                    paginatedApplyApplications.map((application) => (
                      <div
                        key={application.id}
                        className="grid grid-cols-8 gap-4 p-4 border-b hover:bg-muted/20 transition-colors"
                      >
                        <div className="col-span-1 text-sm font-medium">
                          {application.requestId}
                        </div>
                        <div className="col-span-1 text-sm">
                          {application.leaveType}
                        </div>
                        <div className="col-span-1 text-sm">
                          {new Date(application.fromDate).toLocaleDateString()}
                        </div>
                        <div className="col-span-1 text-sm">
                          {new Date(application.toDate).toLocaleDateString()}
                        </div>
                        <div className="col-span-1 text-sm">
                          {application.duration} day{application.duration !== '1' ? 's' : ''}
                        </div>
                        <div className="col-span-1">
                          <Badge className={cn("text-xs", getStatusBadgeClass(application.status))}>
                            {application.status}
                          </Badge>
                        </div>
                        <div className="col-span-1 text-sm text-muted-foreground">
                          {new Date(application.appliedDate).toLocaleDateString()}
                        </div>
                        <div className="col-span-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewLeave(application)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination - Always visible */}
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
                  <div className="text-sm text-gray-600">
                    Showing {leaveApplications.length === 0 ? 0 : applyStartIndex + 1} to {Math.min(applyEndIndex, leaveApplications.length)} of {leaveApplications.length} entries
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setApplyCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={applyCurrentPage === 1}
                      className="h-8 w-8 p-0 border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setApplyCurrentPage(prev => Math.min(applyTotalPages, prev + 1))}
                      disabled={applyCurrentPage >= applyTotalPages || applyTotalPages === 0}
                      className="h-8 w-8 p-0 border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Apply Leave Modal */}
          <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Apply Leave</DialogTitle>
                <DialogDescription>
                  Fill in the details below to submit your leave request.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Leave Type */}
                  <div className="space-y-2">
                    <Label htmlFor="leaveType">Leave Type <span className="text-red-500">*</span></Label>
                    <Select value={formData.leaveType} onValueChange={(value) => handleInputChange('leaveType', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.leaveType && (
                      <p className="text-sm text-red-500">{formErrors.leaveType}</p>
                    )}
                  </div>

                  {/* Half Day Switch */}
                  <div className="space-y-2">
                    <Label htmlFor="halfDay">Half Day</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="halfDay"
                        checked={formData.halfDay}
                        onCheckedChange={(checked: boolean) => {
                          handleInputChange('halfDay', checked);
                          if (!checked) {
                            handleInputChange('halfDaySession', '');
                          }
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.halfDay ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Date Fields - Single date for Half Day, From/To dates for Full Day */}
                  {formData.halfDay ? (
                    // Single Date Picker for Half Day
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="leaveDate">Leave Date <span className="text-red-500">*</span></Label>
                      <DatePicker 
                        date={formData.fromDate} 
                        setDate={(date) => {
                          handleInputChange('fromDate', date);
                          handleInputChange('toDate', date); // Set same date for both
                        }}
                        minDate={new Date()} // Block past dates
                        blockedDates={getBlockedDates()} // Block existing leave dates
                      />
                      {formErrors.fromDate && (
                        <p className="text-sm text-red-500">{formErrors.fromDate}</p>
                      )}
                    </div>
                  ) : (
                    // From and To Date Pickers for Full Day
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="fromDate">From Date <span className="text-red-500">*</span></Label>
                        <DatePicker 
                          date={formData.fromDate} 
                          setDate={(date) => handleInputChange('fromDate', date)}
                          minDate={new Date()} // Block past dates
                          blockedDates={getBlockedDates()} // Block existing leave dates
                        />
                        {formErrors.fromDate && (
                          <p className="text-sm text-red-500">{formErrors.fromDate}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="toDate">To Date <span className="text-red-500">*</span></Label>
                        <DatePicker 
                          date={formData.toDate} 
                          setDate={(date) => handleInputChange('toDate', date)}
                          minDate={formData.fromDate || new Date()} // Block dates before fromDate or today
                          blockedDates={getBlockedDates()} // Block existing leave dates
                        />
                        {formErrors.toDate && (
                          <p className="text-sm text-red-500">{formErrors.toDate}</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Half Day Session (Conditional) - Now using Select dropdown */}
                  {formData.halfDay && (
                    <div className="space-y-2">
                      <Label>Half Day Session <span className="text-red-500">*</span></Label>
                      <Select value={formData.halfDaySession} onValueChange={(value) => handleInputChange('halfDaySession', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM (Morning)</SelectItem>
                          <SelectItem value="PM">PM (Afternoon)</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.halfDaySession && (
                        <p className="text-sm text-red-500">{formErrors.halfDaySession}</p>
                      )}
                    </div>
                  )}

                  {/* Auto-Generated Fields */}
                  <div className="space-y-2">
                    <Label>Requested Duration</Label>
                    <Input
                      value={`${calculateDuration()} day${calculateDuration() !== '1' ? 's' : ''}`}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Available Balance</Label>
                    <Input
                      value="As per company policy (from system)"
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>After Request Balance</Label>
                    <Input
                      value="Calculated by system after approval"
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter reason for leave..."
                    value={formData.reason}
                    onChange={(e) => handleInputChange('reason', e.target.value)}
                    rows={3}
                  />
                  {formErrors.reason && (
                    <p className="text-sm text-red-500">{formErrors.reason}</p>
                  )}
                </div>

                {/* Attachment Upload (Conditional) */}
                {attachmentRequiredFor.includes(formData.leaveType) && (
                  <div className="space-y-2">
                    <Label htmlFor="attachment">Attachment <span className="text-red-500">*</span></Label>
                    <Input
                      id="attachment"
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    {formData.attachment && (
                      <p className="text-sm text-green-600">File selected: {formData.attachment.name}</p>
                    )}
                    {formErrors.attachment && (
                      <p className="text-sm text-red-500">{formErrors.attachment}</p>
                    )}
                  </div>
                )}

                {/* Warnings */}
                {showAttachmentWarning && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Attachment required for {formData.leaveType} leave type.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleModalCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled}
                  className={cn(
                    "transition-colors",
                    isSubmitDisabled 
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300" 
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Leave Details Modal */}
          <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Leave Application Details</DialogTitle>
                <DialogDescription>
                  View complete details of the leave application.
                </DialogDescription>
              </DialogHeader>

              {selectedApplication && (
                <div className="space-y-6 py-4">
                  {/* Form Fields - All Disabled */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Request ID */}
                    <div className="space-y-2">
                      <Label>Request ID</Label>
                      <Input value={selectedApplication.requestId} disabled className="bg-muted" />
                    </div>

                    {/* Leave Type */}
                    <div className="space-y-2">
                      <Label>Leave Type</Label>
                      <Input value={selectedApplication.leaveType} disabled className="bg-muted" />
                    </div>

                    {/* Half Day */}
                    <div className="space-y-2">
                      <Label>Half Day</Label>
                      <Input value={selectedApplication.halfDay ? 'Yes' : 'No'} disabled className="bg-muted" />
                    </div>

                    {/* Half Day Session (if applicable) */}
                    {selectedApplication.halfDay && (
                      <div className="space-y-2">
                        <Label>Half Day Session</Label>
                        <Input value={selectedApplication.halfDaySession} disabled className="bg-muted" />
                      </div>
                    )}

                    {/* Date Fields */}
                    {selectedApplication.halfDay ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Leave Date</Label>
                        <Input value={new Date(selectedApplication.fromDate).toLocaleDateString()} disabled className="bg-muted" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>From Date</Label>
                          <Input value={new Date(selectedApplication.fromDate).toLocaleDateString()} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                          <Label>To Date</Label>
                          <Input value={new Date(selectedApplication.toDate).toLocaleDateString()} disabled className="bg-muted" />
                        </div>
                      </>
                    )}

                    {/* Duration */}
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Input value={`${selectedApplication.duration} day${selectedApplication.duration !== '1' ? 's' : ''}`} disabled className="bg-muted" />
                    </div>

                    {/* Applied Date */}
                    <div className="space-y-2">
                      <Label>Applied Date</Label>
                      <Input value={new Date(selectedApplication.appliedDate).toLocaleDateString()} disabled className="bg-muted" />
                    </div>

                    {/* Available Balance */}
                    <div className="space-y-2">
                      <Label>Available Balance</Label>
                      <Input value="As per company policy (from system)" disabled className="bg-muted" />
                    </div>

                    {/* After Request Balance */}
                    <div className="space-y-2 md:col-span-2">
                      <Label>After Request Balance</Label>
                      <Input value="Calculated by system after approval" disabled className="bg-muted" />
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea
                      value={selectedApplication.reason}
                      disabled
                      className="bg-muted"
                      rows={3}
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center">
                      <Badge className={cn("text-xs", getStatusBadgeClass(selectedApplication.status))}>
                        {selectedApplication.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Remarks Section */}
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea
                      value={selectedApplication.remarks || 'No remarks available'}
                      disabled
                      className="bg-muted"
                      rows={2}
                    />
                  </div>

                  {/* Attachment (if any) */}
                  {selectedApplication.attachment && (
                    <div className="space-y-2">
                      <Label>Attachment</Label>
                      <div className="flex items-center gap-2">
                        <Input value={selectedApplication.attachment.name} disabled className="bg-muted flex-1" />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            try {
                              if (selectedApplication.attachment) {
                                if (selectedApplication.attachment instanceof File) {
                                  const url = URL.createObjectURL(selectedApplication.attachment);
                                  window.open(url, '_blank');
                                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                                } else if (selectedApplication.attachment.name) {
                                  alert(`Attachment: ${selectedApplication.attachment.name}\n\nNote: This is mock data. In a real application, this would open the actual uploaded document.`);
                                }
                              }
                            } catch (error) {
                              console.error('Error opening attachment:', error);
                              alert('Unable to open attachment. Please try again.');
                            }
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <div className="flex justify-between w-full">
                  {/* Delete button - only show for Pending status */}
                  {selectedApplication && selectedApplication.status === 'Pending' ? (
                    <Button 
                      variant="destructive" 
                      onClick={() => handleDeleteLeave(selectedApplication)}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  ) : (
                    <div></div> // Empty div to maintain spacing
                  )}
                  
                  <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="management" className="flex-1 mt-6">
          <div className="space-y-6">
            {/* Filters Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <SearchableSelect
                    label="Status"
                    value={statusFilter}
                    options={["All", "Pending", "Approved", "Refused", "Cancelled", "Draft"]}
                    onChange={setStatusFilter}
                  />

                  {/* Leave Type Filter */}
                  <SearchableSelect
                    label="Leave Type"
                    value={leaveTypeFilter}
                    options={["All", "Paid", "Sick", "Casual", "Annual", "Unpaid", "Maternity", "Paternity"]}
                    onChange={setLeaveTypeFilter}
                  />

                  {/* Search Filter */}
                  <div className="space-y-2">
                    <Label>Search</Label>
                    <Input
                      placeholder="Search by name, type..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leave Applications List */}
            <Card>
              <CardContent className="p-0">
                {/* Table Header */}
                <div className="grid grid-cols-9 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                  <div className="col-span-1">Request ID</div>
                  <div className="col-span-1">Employee</div>
                  <div className="col-span-1">Leave Type</div>
                  <div className="col-span-1">From Date</div>
                  <div className="col-span-1">To Date</div>
                  <div className="col-span-1">Duration</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Attachment</div>
                  <div className="col-span-1">Actions</div>
                </div>

                {/* Table Rows */}
                <div className="space-y-0">
                  {paginatedManagementApplications.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">
                        {searchQuery || statusFilter !== "All" || leaveTypeFilter !== "All"
                          ? "No matching applications found" 
                          : "No leave applications found"}
                      </p>
                      <p className="text-sm">
                        {searchQuery || statusFilter !== "All" || leaveTypeFilter !== "All"
                          ? "Try adjusting your search criteria or filters" 
                          : "Leave applications will appear here for management"}
                      </p>
                    </div>
                  ) : (
                    paginatedManagementApplications.map((application) => (
                      <div
                        key={application.id}
                        className="grid grid-cols-9 gap-4 p-4 border-b hover:bg-muted/20 transition-colors"
                      >
                        <div className="col-span-1 text-sm font-medium">
                          {application.requestId}
                        </div>
                        <div className="col-span-1 text-sm">
                          {application.employeeName ? (
                            <div>
                              <div className="font-medium">{application.employeeName}</div>
                              <div className="text-xs text-muted-foreground">{application.employeeId}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div className="col-span-1 text-sm">
                          {application.leaveType}
                        </div>
                        <div className="col-span-1 text-sm">
                          {new Date(application.fromDate).toLocaleDateString()}
                        </div>
                        <div className="col-span-1 text-sm">
                          {new Date(application.toDate).toLocaleDateString()}
                        </div>
                        <div className="col-span-1 text-sm">
                          {application.duration} day{application.duration !== '1' ? 's' : ''}
                        </div>
                        <div className="col-span-1">
                          <Badge className={cn("text-xs", getStatusBadgeClass(application.status))}>
                            {application.status}
                          </Badge>
                        </div>
                        <div className="col-span-1 text-sm">
                          {application.attachment ? (
                            <button 
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              onClick={() => {
                                try {
                                  if (application.attachment) {
                                    // Check if it's a File object or just has a name property
                                    if (application.attachment instanceof File) {
                                      // Create a temporary URL for the actual file and open it
                                      const url = URL.createObjectURL(application.attachment);
                                      window.open(url, '_blank');
                                      // Clean up the URL after a short delay
                                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                                    } else if (application.attachment.name) {
                                      // For mock data with just name property, show the filename
                                      alert(`Attachment: ${application.attachment.name}\n\nNote: This is mock data. In a real application, this would open the actual uploaded document.`);
                                    }
                                  }
                                } catch (error) {
                                  console.error('Error opening attachment:', error);
                                  alert('Unable to open attachment. Please try again.');
                                }
                              }}
                            >
                              <FileSpreadsheet className="h-3 w-3" />
                              <span>Yes</span>
                            </button>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div className="col-span-1">
                          <Button variant="ghost" size="sm" onClick={() => handleManageLeave(application)}>
                            Manage
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination - Always visible */}
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
                  <div className="text-sm text-gray-600">
                    Showing {filteredApplications.length === 0 ? 0 : managementStartIndex + 1} to {Math.min(managementEndIndex, filteredApplications.length)} of {filteredApplications.length} entries
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManagementCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={managementCurrentPage === 1}
                      className="h-8 w-8 p-0 border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManagementCurrentPage(prev => Math.min(managementTotalPages, prev + 1))}
                      disabled={managementCurrentPage >= managementTotalPages || managementTotalPages === 0}
                      className="h-8 w-8 p-0 border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Manage Leave Modal */}
          <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Leave Application</DialogTitle>
                <DialogDescription>
                  Review and manage leave request {managedApplication?.requestId}
                </DialogDescription>
              </DialogHeader>

              {managedApplication && (
                <div className="space-y-6 py-4">
                  {/* Employee Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Employee Name</Label>
                      <Input value={managedApplication.employeeName || "—"} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Employee ID</Label>
                      <Input value={managedApplication.employeeId || "—"} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input value={managedApplication.department || "—"} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Manager</Label>
                      <Input value={managedApplication.manager || "—"} disabled className="bg-muted" />
                    </div>
                  </div>

                  {/* Request Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Request ID</Label>
                      <Input value={managedApplication.requestId} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Leave Type</Label>
                      <Input value={managedApplication.leaveType} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Half Day</Label>
                      <Input value={managedApplication.halfDay ? 'Yes' : 'No'} disabled className="bg-muted" />
                    </div>
                    {managedApplication.halfDay && (
                      <div className="space-y-2">
                        <Label>Half Day Session</Label>
                        <Input value={managedApplication.halfDaySession || "—"} disabled className="bg-muted" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>From Date</Label>
                      <Input value={new Date(managedApplication.fromDate).toLocaleDateString()} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>To Date</Label>
                      <Input value={new Date(managedApplication.toDate).toLocaleDateString()} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Input value={`${managedApplication.duration} day${managedApplication.duration !== '1' ? 's' : ''}`} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Applied On</Label>
                      <Input value={formatDateTime(managedApplication.appliedOn)} disabled className="bg-muted" />
                    </div>
                  </div>

                  {/* Policy Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Available Balance</Label>
                      <Input value="As per company policy (from system)" disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>After Request Balance</Label>
                      <Input value="Calculated by system after approval" disabled className="bg-muted" />
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea
                      value={managedApplication.reason}
                      disabled
                      className="bg-muted"
                      rows={3}
                    />
                  </div>

                  {/* Attachment */}
                  <div className="space-y-2">
                    <Label>Attachment</Label>
                    {managedApplication.attachment ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-fit"
                        onClick={() => {
                          try {
                            if (managedApplication.attachment) {
                              // Check if it's a File object or just has a name property
                              if (managedApplication.attachment instanceof File) {
                                // Create a temporary URL for the actual file and open it
                                const url = URL.createObjectURL(managedApplication.attachment);
                                window.open(url, '_blank');
                                // Clean up the URL after a short delay
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                              } else if (managedApplication.attachment.name) {
                                // For mock data with just name property, show the filename
                                alert(`Attachment: ${managedApplication.attachment.name}\n\nNote: This is mock data. In a real application, this would open the actual uploaded document.`);
                              }
                            }
                          } catch (error) {
                            console.error('Error opening attachment:', error);
                            alert('Unable to open attachment. Please try again.');
                          }
                        }}
                      >
                        View Attachment
                      </Button>
                    ) : (
                      <Input value="No attachment" disabled className="bg-muted" />
                    )}
                  </div>

                  {/* Status Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status <span className="text-red-500">*</span></Label>
                    <Select value={managementFormData.status} onValueChange={(value) => setManagementFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Refused">Refused</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remarks - Editable */}
                  <div className="space-y-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      placeholder="Enter management remarks..."
                      value={managementFormData.remarks}
                      onChange={(e) => setManagementFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsManageModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleManagementSubmit}
                  disabled={!managementFormData.status}
                  className={cn(
                    "transition-colors",
                    !managementFormData.status 
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300" 
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="calendar" className="flex-1 mt-6">
          <div className="space-y-6">
            {/* Calendar Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">Employee Leave Calendar</h2>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-600">My Leaves</span>
                </div>
              </div>
              
              {/* View Toggle and Apply Leave Button */}
              <div className="flex items-center gap-4">
                <div className="flex bg-muted rounded-lg p-1">
                  <Button
                    variant={calendarView === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCalendarView('week')}
                    className="text-xs px-3"
                  >
                    Week
                  </Button>
                  <Button
                    variant={calendarView === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCalendarView('month')}
                    className="text-xs px-3"
                  >
                    Month
                  </Button>
                  <Button
                    variant={calendarView === 'year' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCalendarView('year')}
                    className="text-xs px-3"
                  >
                    Year
                  </Button>
                </div>
                <Button onClick={() => setLocation("/hrms/leave-management/apply")} className="bg-blue-600 hover:bg-blue-700">
                  Apply Leave
                </Button>
              </div>
            </div>

            {/* Calendar Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateCalendar(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <h3 className="text-lg font-semibold">
                {calendarView === 'year' 
                  ? currentDate.getFullYear()
                  : calendarView === 'month'
                  ? format(currentDate, 'MMMM yyyy')
                  : `Week of ${format(getWeekStart(currentDate), 'MMM dd, yyyy')}`
                }
              </h3>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateCalendar(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {calendarView === 'month' && renderMonthView()}
                {calendarView === 'week' && renderWeekView()}
                {calendarView === 'year' && renderYearView()}
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-100"></div>
                <span className="text-sm font-medium">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-100"></div>
                <span className="text-sm font-medium">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-100"></div>
                <span className="text-sm font-medium">Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-100"></div>
                <span className="text-sm font-medium">Holiday</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this leave application?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the leave application "{appToDelete?.requestId || 'this application'}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// DatePicker Component with minDate and blocked dates support
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
        // Use minDate if provided, otherwise use today
        const minimumDate = minDate || new Date();
        minimumDate.setHours(0, 0, 0, 0);
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);
        
        // Check if date is blocked
        const isBlocked = blockedDates?.some(blockedDate => {
            const blocked = new Date(blockedDate);
            blocked.setHours(0, 0, 0, 0);
            return blocked.getTime() === selected.getTime();
        });
        
        // Only allow dates >= minimumDate and not blocked
        if (selected >= minimumDate && !isBlocked) {
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
        const minimumDate = minDate || new Date();
        minimumDate.setHours(0, 0, 0, 0);
        
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
                isPast: dayDate < minimumDate
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = currentDate.getTime() === minimumDate.getTime();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            const isPast = currentDate < minimumDate;
            
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
                isPast: dayDate < minimumDate
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