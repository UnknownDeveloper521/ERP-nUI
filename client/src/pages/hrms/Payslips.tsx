/**
 * ============================================================================
 * PAYSLIPS TAB - HR/ADMIN AND EMPLOYEE VIEWS (AUTO PAYSLIP FLOW)
 * ============================================================================
 * 
 * FLOW CHANGE: FULL AUTO PAYSLIP VISIBILITY
 * 
 * Key Changes:
 * - NO Send/Resend buttons - payslips are automatically available when Locked
 * - Payslip visibility controlled ONLY by Payroll Status (Locked = Available)
 * - "Resolve via Payroll" automatically unlocks payroll (Locked -> Draft)
 * - Employee cannot view payslip until payroll is locked again
 * - Query status: Open -> In Progress (when resolving) -> Resolved
 * 
 * HR/Admin View:
 * - Sub-tabs: All Payslips, Queries (removed "Sent" tab)
 * - Shows Payroll Status and Payslip Availability
 * - Can view payslips and respond to queries
 * 
 * Employee View:
 * - Combined table showing payroll + payslip availability
 * - Can view/download only when Payroll Status = Locked
 * - Can raise queries only when payslip is available
 * 
 * ============================================================================
 */

import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import { Search, Printer, Eye, MessageSquare, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SimulatedRole = "Admin" | "HR Manager" | "Employee";
type PayrollStatus = "Draft" | "Calculated" | "Locked";
type PayslipAvailability = "Available" | "Not Ready"; // Simplified status
type QueryStatus = "Open" | "In Progress" | "Resolved" | "Closed";

interface Payslip {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  payPeriodId: string;
  periodName: string;
  payrollStatus: PayrollStatus;
  // Payslip availability is derived from payrollStatus (Locked = Available)
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paidDays: number;
  otHours: number;
  lwpDays: number;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
}

interface Query {
  id: string;
  employeeId: string;
  employeeName: string;
  payslipId: string;
  periodName: string;
  subject: string;
  message: string;
  attachmentUrl?: string;
  status: QueryStatus;
  hrReply?: string;
  createdAt: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================
// 
// 📋 MOCK DATA GUIDE (AUTO PAYSLIP FLOW):
// - Payslip availability is determined by payrollStatus:
//   - Locked = Available (employee can view/download)
//   - Draft/Calculated = Not Ready (employee cannot view)
// - No "Sent" status - removed from flow
// - Query statuses: Open, In Progress, Resolved, Closed
// 
// ⚠️ SAFE GUARD: Added ONE mock record to prevent runtime crashes when arrays are empty
// This ensures UI never crashes and you can test flows immediately
// ============================================================================

const MOCK_PAY_PERIODS: any[] = [
  {
    id: "pp-001",
    name: "January 2026",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    status: "Open"
  }
];

const MOCK_PAYSLIPS: Payslip[] = [
  {
    id: "ps-001",
    employeeId: "emp-001",
    employeeCode: "EMP001",
    employeeName: "John Doe",
    department: "Engineering",
    payPeriodId: "pp-001",
    periodName: "January 2026",
    payrollStatus: "Locked",
    grossPay: 50000,
    totalDeductions: 5000,
    netPay: 45000,
    paidDays: 26,
    otHours: 10,
    lwpDays: 0,
    earnings: [
      { name: "Basic Salary", amount: 30000 },
      { name: "HRA", amount: 15000 },
      { name: "Overtime", amount: 5000 }
    ],
    deductions: [
      { name: "PF", amount: 3000 },
      { name: "Tax", amount: 2000 }
    ]
  }
];

const MOCK_QUERIES: Query[] = [
  {
    id: "q-001",
    employeeId: "emp-001",
    employeeName: "John Doe",
    payslipId: "ps-001",
    periodName: "January 2026",
    subject: "Overtime calculation query",
    message: "I worked 10 hours overtime but only 5 hours are reflected in my payslip.",
    status: "Open",
    createdAt: "2026-01-15"
  }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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
        <div>
            <Label className="text-sm font-medium mb-2 block">
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

export default function Payslips({ simulatedRole }: { simulatedRole: SimulatedRole }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // ============================================================================
  // ROLE-BASED VIEW LOGIC
  // ============================================================================
  // PURPOSE: Determines which view to show (HR sees all, Employee sees own)
  // WHY NEEDED: Different roles have different permissions and data access
  // KEEP: Essential for role-based access control
  // ============================================================================
  const isHROrAdmin = simulatedRole === "Admin" || simulatedRole === "HR Manager";
  const isEmployee = simulatedRole === "Employee";

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // ============================================================================
  // FILTER STATE
  // ============================================================================
  // PURPOSE: Allows filtering payslips by period, department, search
  // WHY NEEDED: HR needs to find specific payslips quickly
  // KEEP: Essential for usability with large datasets
  // ============================================================================
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // ============================================================================
  // HR SUB-TAB STATE
  // ============================================================================
  // PURPOSE: Switches between "All Payslips" and "Queries" views for HR
  // WHY NEEDED: Organizes HR features - payslip management vs query handling
  // KEEP: Essential for HR workflow organization
  // ============================================================================
  const [hrSubTab, setHrSubTab] = useState<"all" | "queries">("all");

  // ============================================================================
  // DIALOG STATE
  // ============================================================================
  // PURPOSE: Controls visibility of various modal dialogs
  // WHY NEEDED: User interactions require modal dialogs for details/forms
  // KEEP: Essential for UI interactions
  // ============================================================================
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [showQueryDetailDialog, setShowQueryDetailDialog] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [showReopenPayrollDialog, setShowReopenPayrollDialog] = useState(false);

  // ============================================================================
  // QUERY FORM STATE
  // ============================================================================
  // PURPOSE: Stores form input for raising/replying to queries
  // WHY NEEDED: Employees raise queries, HR replies to them
  // KEEP: Essential for query management feature
  // ============================================================================
  const [querySubject, setQuerySubject] = useState("");
  const [queryMessage, setQueryMessage] = useState("");
  const [queryReply, setQueryReply] = useState("");

  // ============================================================================
  // DATA STATE (MUTABLE)
  // ============================================================================
  // PURPOSE: Stores queries and payslips - can be modified by user actions
  // WHY MUTABLE: Queries can be created/updated, payslips status can change
  // NOTE: In production, this will be replaced with API calls
  // KEEP: Essential for data management (replace with API later)
  // ============================================================================
  const [queries, setQueries] = useState<Query[]>(MOCK_QUERIES);
  const [payslips, setPayslips] = useState<Payslip[]>(MOCK_PAYSLIPS);

  // ============================================================================
  // PAGINATION STATE
  // ============================================================================
  // PURPOSE: Shows payslips in pages instead of all at once
  // WHY NEEDED: Performance - prevents rendering 100+ payslips at once
  // KEEP: Essential for performance with large datasets
  // ============================================================================
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQueriesPage, setCurrentQueriesPage] = useState(1);
  const itemsPerPage = 10;

  // ============================================================================
  // FILTERED DATA - COMPUTED FROM STATE
  // ============================================================================
  // PURPOSE: Applies filters to payslips based on role, period, department, search
  // WHY USEMEMO: Prevents recalculation on every render - only when dependencies change
  // KEEP: Essential for performance and filtering functionality
  // ============================================================================

  const filteredPayslips = useMemo(() => {
    let filtered = payslips;

    // ========================================================================
    // ROLE-BASED FILTERING
    // ========================================================================
    // PURPOSE: Employees see only their own payslips (security)
    // WHY NEEDED: Data privacy - employees shouldn't see others' salaries
    // KEEP: Essential for security and privacy
    // ========================================================================
    if (isEmployee) {
      filtered = filtered.filter((p) => p.employeeId === "emp-001");
    }

    // ========================================================================
    // PERIOD FILTER
    // ========================================================================
    // PURPOSE: Shows payslips for selected pay period only
    // WHY NEEDED: Users typically work with one period at a time
    // KEEP: Essential for focused data viewing
    // ========================================================================
    if (selectedPeriodId !== "all") {
      filtered = filtered.filter((p) => p.payPeriodId === selectedPeriodId);
    }

    // ========================================================================
    // DEPARTMENT FILTER (HR/Admin only)
    // ========================================================================
    // PURPOSE: HR can filter by department to process department-wise
    // WHY NEEDED: Large organizations process payroll by department
    // KEEP: Essential for HR workflow efficiency
    // ========================================================================
    if (isHROrAdmin && deptFilter !== "all") {
      filtered = filtered.filter((p) => p.department === deptFilter);
    }

    // Search filter (HR/Admin only)
    if (isHROrAdmin && searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.employeeCode.toLowerCase().includes(query) ||
          p.employeeName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [payslips, selectedPeriodId, deptFilter, searchQuery, isHROrAdmin, isEmployee]);

  const filteredQueries = useMemo(() => {
    return queries;
  }, [queries]);

  // Pagination for payslips
  const totalPages = Math.ceil(filteredPayslips.length / itemsPerPage);
  const paginatedPayslips = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayslips.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayslips, currentPage]);

  // Pagination for queries
  const totalQueriesPages = Math.ceil(filteredQueries.length / itemsPerPage);
  const paginatedQueries = useMemo(() => {
    const startIndex = (currentQueriesPage - 1) * itemsPerPage;
    return filteredQueries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredQueries, currentQueriesPage]);

  // ============================================================================
  // EVENT HANDLERS (AUTO PAYSLIP FLOW)
  // ============================================================================

  // View payslip - check if available (Locked status)
  const handleViewPayslip = (payslip: Payslip) => {
    // Deep link protection: Employee can only view if payroll is Locked
    if (isEmployee && payslip.payrollStatus !== "Locked") {
      toast({
        title: "Payslip Not Available",
        description: "Payslip is not available yet. Payroll is not locked for this period.",
        variant: "destructive",
      });
      return;
    }

    // Find the latest version of the payslip from state
    const currentPayslip = payslips.find((p) => p.id === payslip.id) || payslip;
    setSelectedPayslip(currentPayslip);
  };

  const handleDownloadPayslip = (payslip: Payslip) => {
    // ============================================================================
    // PRINT PAYSLIP AS PDF
    // ============================================================================
    // This opens the browser's native print dialog which allows saving as PDF
    // No library installation needed, no file creation, no browser permissions
    // 
    // How it works:
    // 1. Create a hidden iframe with payslip content
    // 2. Trigger browser's print dialog (window.print())
    // 3. User can save as PDF directly from print dialog
    // 4. Clean up the iframe after printing
    // ============================================================================
    
    // ⚠️ SAFE GUARD: Using optional chaining and nullish coalescing to prevent crashes
    // This ensures the code never crashes even if payslip data is undefined or null
    // ============================================================================
    const payslipHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${payslip?.employeeCode ?? 'N/A'} - ${payslip?.periodName ?? 'N/A'}</title>
  <style>
    @page { margin: 20mm; }
    @media print { 
      body { margin: 0; }
      .no-print { display: none; }
    }
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #333; }
    .payslip-title { font-size: 18px; color: #666; margin-top: 10px; }
    .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .info-item { margin-bottom: 10px; }
    .info-label { font-weight: bold; color: #666; font-size: 12px; }
    .info-value { font-size: 14px; color: #333; margin-top: 5px; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
    .summary-label { font-size: 12px; color: #666; }
    .summary-value { font-size: 20px; font-weight: bold; color: #333; margin-top: 5px; }
    .tables-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; }
    th { background-color: #f5f5f5; padding: 10px; text-align: left; font-size: 12px; border-bottom: 2px solid #ddd; }
    td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
    .earnings-header { background-color: #d4edda !important; }
    .deductions-header { background-color: #f8d7da !important; }
    .total-row { font-weight: bold; background-color: #f9f9f9; }
    .net-pay-section { background-color: #e3f2fd; border: 2px solid #2196f3; padding: 20px; border-radius: 5px; text-align: center; margin-bottom: 30px; }
    .net-pay-label { font-size: 16px; color: #666; }
    .net-pay-value { font-size: 28px; font-weight: bold; color: #2196f3; margin-top: 10px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">Tassos Consultancy Services</div>
    <div class="payslip-title">Payslip for ${payslip.periodName}</div>
  </div>

  <div class="info-section">
    <div>
      <div class="info-item">
        <div class="info-label">Employee Code</div>
        <div class="info-value">${payslip.employeeCode}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Employee Name</div>
        <div class="info-value">${payslip.employeeName}</div>
      </div>
    </div>
    <div>
      <div class="info-item">
        <div class="info-label">Department</div>
        <div class="info-value">${payslip.department}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Pay Period</div>
        <div class="info-value">${payslip.periodName}</div>
      </div>
    </div>
  </div>

  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-label">Paid Days</div>
      <div class="summary-value">${payslip.paidDays}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">OT Hours</div>
      <div class="summary-value">${payslip.otHours}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">LWP Days</div>
      <div class="summary-value">${payslip.lwpDays}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Gross Pay</div>
      <div class="summary-value">₹${payslip.grossPay.toLocaleString()}</div>
    </div>
  </div>

  <div class="tables-section">
    <div>
      <table>
        <thead>
          <tr class="earnings-header">
            <th>Earnings</th>
            <th style="text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${(payslip?.earnings ?? []).map(e => `
            <tr>
              <td>${e?.name ?? '-'}</td>
              <td style="text-align: right;">${(e?.amount ?? 0).toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>Total Earnings</td>
            <td style="text-align: right;">₹${(payslip?.grossPay ?? 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead>
          <tr class="deductions-header">
            <th>Deductions</th>
            <th style="text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${(payslip?.deductions ?? []).map(d => `
            <tr>
              <td>${d?.name ?? '-'}</td>
              <td style="text-align: right;">${(d?.amount ?? 0).toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>Total Deductions</td>
            <td style="text-align: right;">₹${(payslip?.totalDeductions ?? 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-pay-section">
    <div class="net-pay-label">Net Pay</div>
    <div class="net-pay-value">₹${payslip.netPay.toLocaleString()}</div>
  </div>

  <div class="footer">
    <p>This is a computer-generated payslip and does not require a signature.</p>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
    `;

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    
    document.body.appendChild(iframe);
    
    // Write content to iframe
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(payslipHTML);
      iframeDoc.close();
      
      // Wait for content to load, then trigger print
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          
          // Clean up after print dialog closes
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 250);
      };
    }
  };

  // Raise query - only allowed when payroll is Locked
  const handleRaiseQuery = () => {
    if (!selectedPayslip) return;
    
    // Employee can only raise query if payslip is available (Locked)
    if (selectedPayslip.payrollStatus !== "Locked") {
      toast({
        title: "Cannot Raise Query",
        description: "You can only raise queries for available payslips.",
        variant: "destructive",
      });
      return;
    }
    
    setShowQueryDialog(true);
  };

  const handleSubmitQuery = () => {
    if (!querySubject.trim() || !queryMessage.trim() || !selectedPayslip) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const newQuery: Query = {
      id: `q-${Date.now()}`,
      employeeId: selectedPayslip.employeeId,
      employeeName: selectedPayslip.employeeName,
      payslipId: selectedPayslip.id,
      periodName: selectedPayslip.periodName,
      subject: querySubject,
      message: queryMessage,
      status: "Open",
      createdAt: new Date().toISOString().split("T")[0],
    };

    setQueries([newQuery, ...queries]);
    
    toast({
      title: "Query Submitted",
      description: "Your query has been submitted to HR successfully.",
    });

    // Reset form and close dialog
    setShowQueryDialog(false);
    setQuerySubject("");
    setQueryMessage("");
  };

  const handleViewQuery = (query: Query) => {
    setSelectedQuery(query);
    setQueryReply("");
    setShowQueryDetailDialog(true);
  };

  const handleSendReply = () => {
    if (!queryReply.trim() || !selectedQuery) {
      toast({
        title: "Error",
        description: "Please enter a reply message.",
        variant: "destructive",
      });
      return;
    }

    // Update the query with the reply
    setQueries(
      queries.map((q) =>
        q.id === selectedQuery.id ? { ...q, hrReply: queryReply } : q
      )
    );

    // Update the selected query to show the reply immediately
    setSelectedQuery({ ...selectedQuery, hrReply: queryReply });

    toast({
      title: "Reply Sent",
      description: "Your reply has been sent to the employee successfully.",
    });

    // Clear the reply input
    setQueryReply("");
  };

  const handleMarkResolved = () => {
    if (!selectedQuery) return;

    // Can only mark resolved if status is Open or In Progress
    if (selectedQuery.status !== "Open" && selectedQuery.status !== "In Progress") {
      toast({
        title: "Cannot Mark Resolved",
        description: "Query is already resolved or closed.",
        variant: "destructive",
      });
      return;
    }

    // Update the query status to resolved
    setQueries(
      queries.map((q) =>
        q.id === selectedQuery.id ? { ...q, status: "Resolved" } : q
      )
    );

    toast({
      title: "Query Resolved",
      description: "Query has been marked as resolved successfully.",
    });

    // Close the dialog
    setShowQueryDetailDialog(false);
    setSelectedQuery(null);
  };

  // REMOVED: handleResendPayslip - no longer needed in AUTO flow

  // ============================================================================
  // RESOLVE VIA PAYROLL (AUTO UNLOCK + REDIRECT)
  // ============================================================================
  // PURPOSE: When HR needs to fix payroll to resolve a query
  // HOW IT WORKS:
  //   1. Changes payroll status from Locked → Draft (unlocks for editing)
  //   2. Changes query status to "In Progress" (marks as being worked on)
  //   3. Hides payslip from employee (until payroll is locked again)
  //   4. Redirects HR to payroll entry form to make corrections
  // WHY NEEDED: Provides workflow for fixing payroll errors reported by employees
  // KEEP: Essential for query resolution workflow
  // ============================================================================
  const handleResolveViaPayroll = () => {
    if (!selectedQuery) return;
    setShowReopenPayrollDialog(true);
  };

  const confirmResolveViaPayroll = () => {
    if (!selectedQuery) return;

    // Find the payslip associated with this query
    const relatedPayslip = payslips.find((p) => p.id === selectedQuery.payslipId);
    
    if (!relatedPayslip) {
      toast({
        title: "Error",
        description: "Could not find the related payslip.",
        variant: "destructive",
      });
      return;
    }

    // ========================================================================
    // AUTOMATIC ACTION 1: UNLOCK PAYROLL
    // ========================================================================
    // PURPOSE: Changes status from Locked → Draft so HR can edit
    // SIDE EFFECT: Payslip becomes unavailable to employee
    // ========================================================================
    setPayslips(
      payslips.map((p) =>
        p.id === relatedPayslip.id
          ? { ...p, payrollStatus: "Draft" as PayrollStatus }
          : p
      )
    );

    // ========================================================================
    // AUTOMATIC ACTION 2: UPDATE QUERY STATUS
    // ========================================================================
    // PURPOSE: Marks query as "In Progress" to track it's being worked on
    // ========================================================================
    setQueries(
      queries.map((q) =>
        q.id === selectedQuery.id ? { ...q, status: "In Progress" } : q
      )
    );

    // Close all dialogs
    setShowReopenPayrollDialog(false);
    setShowQueryDetailDialog(false);
    setSelectedQuery(null);

    toast({
      title: "Payroll Reopened",
      description: `Payroll for ${relatedPayslip.employeeName} - ${relatedPayslip.periodName} has been reopened. Redirecting to Run Payroll...`,
    });

    // ========================================================================
    // AUTOMATIC ACTION 3: REDIRECT TO PAYROLL FORM
    // ========================================================================
    // PURPOSE: Takes HR directly to the payroll entry form for this employee
    // WHY DELAY: Gives user time to read the toast notification
    // ========================================================================
    const periodId = relatedPayslip.payPeriodId;
    const employeeId = relatedPayslip.employeeId;
    
    setTimeout(() => {
      setLocation(`/hrms/payroll-management?periodId=${periodId}&employeeId=${employeeId}`);
    }, 1000);
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  // ============================================================================
  // PAYSLIP AVAILABILITY LOGIC
  // ============================================================================
  // PURPOSE: Determines if payslip is available to employee
  // RULE: Only Locked payrolls have available payslips
  // WHY: Prevents employees from seeing incomplete/draft payroll data
  // KEEP: Essential for payslip visibility control
  // ============================================================================
  const getPayslipAvailability = (payrollStatus: PayrollStatus): PayslipAvailability => {
    return payrollStatus === "Locked" ? "Available" : "Not Ready";
  };

  // ============================================================================
  // STATUS BADGE STYLING
  // ============================================================================
  // PURPOSE: Returns styled badge component for different statuses
  // WHY NEEDED: Consistent visual representation of statuses across UI
  // KEEP: Essential for UI consistency
  // ============================================================================
  const getStatusBadge = (status: PayrollStatus | PayslipAvailability | QueryStatus) => {
    const variants: Record<string, string> = {
      // Payroll Status
      Draft: "bg-gray-100 text-gray-800",
      Calculated: "bg-blue-100 text-blue-800",
      Locked: "bg-green-100 text-green-800",
      // Payslip Availability
      Available: "bg-green-100 text-green-800",
      "Not Ready": "bg-yellow-100 text-yellow-800",
      // Query Status
      Open: "bg-red-100 text-red-800",
      "In Progress": "bg-blue-100 text-blue-800",
      Resolved: "bg-green-100 text-green-800",
      Closed: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={cn("font-medium", variants[status] || "")}>
        {status}
      </Badge>
    );
  };

  // ============================================================================
  // RENDER: HR/ADMIN VIEW
  // ============================================================================

  if (isHROrAdmin) {
    return (
      <div className="space-y-6">
        {/* Filters Section */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SearchableSelect
              label="Pay Period"
              value={selectedPeriodId === "all" ? "All Periods" : MOCK_PAY_PERIODS.find(p => p.id === selectedPeriodId)?.name || ""}
              options={["All Periods", ...MOCK_PAY_PERIODS.map(period => period.name)]}
              onChange={(value) => {
                if (value === "All Periods") {
                  setSelectedPeriodId("all");
                } else {
                  const period = MOCK_PAY_PERIODS.find(p => p.name === value);
                  if (period) setSelectedPeriodId(period.id);
                }
              }}
            />

            <SearchableSelect
              label="Department"
              value={deptFilter === "all" ? "All Departments" : deptFilter}
              options={["All Departments", "Engineering", "HR", "Finance", "Sales", "Marketing", "Operations"]}
              onChange={(value) => {
                setDeptFilter(value === "All Departments" ? "all" : value);
              }}
            />

            <div>
              <Label className="text-sm font-medium mb-2 block">Search</Label>
              <div className="relative w-full flex items-center h-10 border border-zinc-400 rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:ring-inset">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-none shadow-none focus-visible:ring-0 bg-transparent h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tabs (removed "Sent" tab) */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setHrSubTab("all")}
            className={cn(
              "px-4 py-2 font-medium transition-colors",
              hrSubTab === "all"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            All Payslips
          </button>
          <button
            onClick={() => setHrSubTab("queries")}
            className={cn(
              "px-4 py-2 font-medium transition-colors",
              hrSubTab === "queries"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Queries ({filteredQueries.filter((q) => q.status === "Open" || q.status === "In Progress").length})
          </button>
        </div>

        {/* Content based on sub-tab */}
        {hrSubTab === "queries" ? (
          // Queries View
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Period</TableHead>
                    <TableHead className="font-semibold">Subject</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQueries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No queries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedQueries.map((query) => (
                      <TableRow key={query.id}>
                        <TableCell className="font-medium">{query.employeeName}</TableCell>
                        <TableCell>{query.periodName}</TableCell>
                        <TableCell>{query.subject}</TableCell>
                        <TableCell>{getStatusBadge(query.status)}</TableCell>
                        <TableCell>{query.createdAt}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewQuery(query)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination for Queries */}
            {filteredQueries.length > 0 && (
              <div className="flex justify-between items-center px-1 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentQueriesPage - 1) * itemsPerPage + 1} to {Math.min(currentQueriesPage * itemsPerPage, filteredQueries.length)} of {filteredQueries.length} entries
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentQueriesPage((p) => Math.max(1, p - 1))}
                    disabled={currentQueriesPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentQueriesPage((p) => Math.min(totalQueriesPages, p + 1))}
                    disabled={currentQueriesPage === totalQueriesPages || totalQueriesPages === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          // Payslips Table (AUTO FLOW - No Send buttons)
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Employee Code</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Period</TableHead>
                    <TableHead className="font-semibold text-right">Gross Pay</TableHead>
                    <TableHead className="font-semibold text-right">Deductions</TableHead>
                    <TableHead className="font-semibold text-right">Net Pay</TableHead>
                    <TableHead className="font-semibold">Payroll Status</TableHead>
                    <TableHead className="font-semibold">Payslip Availability</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No payslips found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPayslips.map((payslip) => {
                      const availability = getPayslipAvailability(payslip.payrollStatus);
                      return (
                        <TableRow key={payslip.id}>
                          <TableCell className="font-medium">{payslip.employeeCode}</TableCell>
                          <TableCell>{payslip.employeeName}</TableCell>
                          <TableCell>{payslip.periodName}</TableCell>
                          <TableCell className="text-right">₹{payslip.grossPay.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{payslip.totalDeductions.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">₹{payslip.netPay.toLocaleString()}</TableCell>
                          <TableCell>{getStatusBadge(payslip.payrollStatus)}</TableCell>
                          <TableCell>{getStatusBadge(availability)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {/* View and Download buttons - available for all */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPayslip(payslip)}
                                title="View Payslip"
                                className="hover:bg-gray-100"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadPayslip(payslip)}
                                title="Print Payslip"
                                className="hover:bg-gray-100"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filteredPayslips.length > 0 && (
              <div className="flex justify-between items-center px-1 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayslips.length)} of {filteredPayslips.length} entries
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* REMOVED: Send Payslip Confirmation Dialog - no longer needed in AUTO flow */}

        {/* Payslip Detail Dialog - HR/Admin View */}
        {selectedPayslip && (
          <PayslipDetailDialog
            payslip={selectedPayslip}
            onClose={() => setSelectedPayslip(null)}
            getStatusBadge={getStatusBadge}
            getPayslipAvailability={getPayslipAvailability}
          />
        )}

        {/* Query Detail Dialog (HR View) */}
        <QueryDetailDialog
          query={selectedQuery}
          onClose={() => {
            setShowQueryDetailDialog(false);
            setSelectedQuery(null);
          }}
          queryReply={queryReply}
          onReplyChange={setQueryReply}
          onSendReply={handleSendReply}
          onMarkResolved={handleMarkResolved}
          onResolveViaPayroll={handleResolveViaPayroll}
          getStatusBadge={getStatusBadge}
          getPayslipAvailability={getPayslipAvailability}
          isOpen={showQueryDetailDialog}
          isHROrAdmin={isHROrAdmin}
          payslips={payslips}
        />

        {/* Reopen Payroll Confirmation Dialog (renamed from Resolve via Payroll) */}
        <AlertDialog open={showReopenPayrollDialog} onOpenChange={setShowReopenPayrollDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reopen Payroll?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>This will automatically:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Change payroll status from <strong>Locked</strong> to <strong>Draft</strong></li>
                  <li>Change query status to <strong>In Progress</strong></li>
                  <li>Hide payslip from employee until you lock payroll again</li>
                  <li>Redirect you to the payroll entry form for this employee</li>
                </ul>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                  <p className="font-semibold text-amber-900 mb-1">After fixing:</p>
                  <ol className="list-decimal list-inside space-y-1 text-amber-800">
                    <li>Correct payroll values (OT / Paid Days / LWP / extras)</li>
                    <li>Recalculate payroll</li>
                    <li>Lock employee payroll again</li>
                    <li>Updated payslip will be automatically available to employee</li>
                    <li>Return to Queries and mark as Resolved</li>
                  </ol>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmResolveViaPayroll}>
                Continue to Payroll
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ============================================================================
  // RENDER: EMPLOYEE VIEW (AUTO PAYSLIP AVAILABILITY)
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="w-64">
          <SearchableSelect
            label="Pay Period"
            value={selectedPeriodId === "all" ? "All Periods" : MOCK_PAY_PERIODS.find(p => p.id === selectedPeriodId)?.name || ""}
            options={["All Periods", ...MOCK_PAY_PERIODS.map(period => period.name)]}
            onChange={(value) => {
              if (value === "All Periods") {
                setSelectedPeriodId("all");
              } else {
                const period = MOCK_PAY_PERIODS.find(p => p.name === value);
                if (period) setSelectedPeriodId(period.id);
              }
            }}
          />
        </div>
      </div>

      {/* Payslips Table - Combined view with availability */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">Period</TableHead>
              <TableHead className="font-semibold">Payroll Status</TableHead>
              <TableHead className="font-semibold">Payslip Availability</TableHead>
              <TableHead className="font-semibold text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPayslips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                  No payslips found
                </TableCell>
              </TableRow>
            ) : (
              paginatedPayslips.map((payslip) => {
                const availability = getPayslipAvailability(payslip.payrollStatus);
                const isAvailable = payslip.payrollStatus === "Locked";
                
                return (
                  <TableRow key={payslip.id}>
                    <TableCell className="font-medium">{payslip.periodName}</TableCell>
                    <TableCell>{getStatusBadge(payslip.payrollStatus)}</TableCell>
                    <TableCell>{getStatusBadge(availability)}</TableCell>
                    <TableCell className="text-right">
                      {!isAvailable ? (
                        <div className="flex items-center justify-end gap-2 text-gray-400">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">Not Ready</span>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPayslip(payslip)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPayslip(payslip)}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination for Employee View */}
      {filteredPayslips.length > 0 && (
        <div className="flex justify-between items-center px-1 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayslips.length)} of {filteredPayslips.length} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Payslip Detail Dialog */}
      {selectedPayslip && (
        <PayslipDetailDialog
          payslip={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          onRaiseQuery={isEmployee ? handleRaiseQuery : undefined}
          getStatusBadge={getStatusBadge}
          getPayslipAvailability={getPayslipAvailability}
        />
      )}

      {/* Raise Query Dialog */}
      <Dialog open={showQueryDialog} onOpenChange={setShowQueryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Raise Query</DialogTitle>
            <DialogDescription>
              Submit your query regarding the payslip. HR will respond shortly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject *</Label>
              <Input
                placeholder="Enter query subject"
                value={querySubject}
                onChange={(e) => setQuerySubject(e.target.value)}
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                placeholder="Describe your query in detail..."
                value={queryMessage}
                onChange={(e) => setQueryMessage(e.target.value)}
                rows={5}
              />
            </div>
            <div>
              <Label>Attachment (Optional)</Label>
              <Input type="file" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQueryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitQuery}>Submit Query</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ============================================================================
// PAYSLIP DETAIL DIALOG COMPONENT
// ============================================================================

interface PayslipDetailDialogProps {
  payslip: Payslip | null;
  onClose: () => void;
  onRaiseQuery?: () => void;
  getStatusBadge: (status: PayrollStatus | PayslipAvailability | QueryStatus) => React.ReactElement;
  getPayslipAvailability: (payrollStatus: PayrollStatus) => PayslipAvailability;
}

function PayslipDetailDialog({
  payslip,
  onClose,
  onRaiseQuery,
  getStatusBadge,
  getPayslipAvailability,
}: PayslipDetailDialogProps) {
  const handleClose = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  if (!payslip) return null;
  
  const availability = getPayslipAvailability(payslip.payrollStatus);

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip Details</DialogTitle>
          <DialogDescription>
            {payslip?.employeeName} - {payslip?.periodName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600">Employee Code</div>
              <div className="font-medium">{payslip?.employeeCode}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Department</div>
              <div className="font-medium">{payslip?.department}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Payroll Status</div>
              <div>{payslip && getStatusBadge(payslip.payrollStatus)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Payslip Availability</div>
              <div>{getStatusBadge(availability)}</div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Paid Days</div>
                <div className="text-2xl font-bold">{payslip?.paidDays}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">OT Hours</div>
                <div className="text-2xl font-bold">{payslip?.otHours}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">LWP Days</div>
                <div className="text-2xl font-bold">{payslip?.lwpDays}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Net Pay</div>
                <div className="text-2xl font-bold text-green-600">
                  ₹{payslip?.netPay.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Earnings and Deductions */}
          <div className="grid grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <h3 className="font-semibold mb-3 text-green-700">Earnings</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50">
                      <TableHead className="font-semibold">Component</TableHead>
                      <TableHead className="font-semibold text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslip?.earnings.map((earning, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{earning.name}</TableCell>
                        <TableCell className="text-right">
                          ₹{earning.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-green-50 font-semibold">
                      <TableCell>Total Earnings</TableCell>
                      <TableCell className="text-right">
                        ₹{payslip?.grossPay.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="font-semibold mb-3 text-red-700">Deductions</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50">
                      <TableHead className="font-semibold">Component</TableHead>
                      <TableHead className="font-semibold text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslip?.deductions.map((deduction, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{deduction.name}</TableCell>
                        <TableCell className="text-right">
                          ₹{deduction.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-red-50 font-semibold">
                      <TableCell>Total Deductions</TableCell>
                      <TableCell className="text-right">
                        ₹{payslip?.totalDeductions.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Net Pay Summary */}
          <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Net Pay</span>
              <span className="text-2xl font-bold text-blue-600">
                ₹{payslip?.netPay.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          {onRaiseQuery && (
            <Button variant="outline" onClick={onRaiseQuery}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Raise Query
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================================
// QUERY DETAIL DIALOG COMPONENT (HR VIEW - AUTO UNLOCK FLOW)
// ============================================================================

interface QueryDetailDialogProps {
  query: Query | null;
  onClose: () => void;
  queryReply: string;
  onReplyChange: (value: string) => void;
  onSendReply: () => void;
  onMarkResolved: () => void;
  onResolveViaPayroll?: () => void;
  getStatusBadge: (status: PayrollStatus | PayslipAvailability | QueryStatus) => React.ReactElement;
  getPayslipAvailability: (payrollStatus: PayrollStatus) => PayslipAvailability;
  isOpen: boolean;
  isHROrAdmin: boolean;
  payslips: Payslip[];
}

function QueryDetailDialog({
  query,
  onClose,
  queryReply,
  onReplyChange,
  onSendReply,
  onMarkResolved,
  onResolveViaPayroll,
  getStatusBadge,
  getPayslipAvailability,
  isOpen,
  isHROrAdmin,
  payslips,
}: QueryDetailDialogProps) {
  if (!query) return null;

  // Find the related payslip for the payroll snapshot
  const relatedPayslip = payslips.find((p) => p.id === query.payslipId);
  const availability = relatedPayslip ? getPayslipAvailability(relatedPayslip.payrollStatus) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Query Details</DialogTitle>
          <DialogDescription>
            From {query.employeeName} - {query.periodName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Query Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600">Subject</div>
                <div className="text-lg font-semibold">{query.subject}</div>
              </div>
              <div>{getStatusBadge(query.status)}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-600">Date</div>
              <div>{query.createdAt}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">Message</div>
              <div className="p-3 bg-gray-50 rounded border">
                {query.message}
              </div>
            </div>

            {query.attachmentUrl && (
              <div>
                <div className="text-sm font-medium text-gray-600">Attachment</div>
                <a
                  href={query.attachmentUrl}
                  className="text-blue-600 hover:underline text-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Attachment
                </a>
              </div>
            )}
          </div>

          {/* Payroll Snapshot (Read-Only) */}
          {relatedPayslip && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-semibold">
                <RefreshCw className="h-4 w-4" />
                Payroll Snapshot (Read-Only)
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Paid Days:</span>
                  <span className="ml-2 font-medium">{relatedPayslip.paidDays}</span>
                </div>
                <div>
                  <span className="text-gray-600">Net Pay:</span>
                  <span className="ml-2 font-medium text-green-600">
                    ₹{relatedPayslip.netPay.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">OT Hours:</span>
                  <span className="ml-2 font-medium">{relatedPayslip.otHours}</span>
                </div>
                <div>
                  <span className="text-gray-600">Payroll Status:</span>
                  <span className="ml-2">{getStatusBadge(relatedPayslip.payrollStatus)}</span>
                </div>
                <div>
                  <span className="text-gray-600">LWP Days:</span>
                  <span className="ml-2 font-medium">{relatedPayslip.lwpDays}</span>
                </div>
                <div>
                  <span className="text-gray-600">Payslip Availability:</span>
                  <span className="ml-2">{availability && getStatusBadge(availability)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Gross Pay:</span>
                  <span className="ml-2 font-medium">₹{relatedPayslip.grossPay.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-100 p-2 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  To correct payroll values, use "Resolve via Payroll" button below (this will reopen payroll automatically).
                </span>
              </div>
            </div>
          )}

          {/* HR Reply Section */}
          {isHROrAdmin && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Reply to Employee</Label>
              <Textarea
                placeholder="Type your reply here..."
                value={queryReply}
                onChange={(e) => onReplyChange(e.target.value)}
                rows={4}
                className="resize-none"
              />
              {query.hrReply && (
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <div className="text-sm font-medium text-green-800 mb-1">Previous Reply:</div>
                  <div className="text-sm text-green-700">{query.hrReply}</div>
                </div>
              )}
            </div>
          )}

          {/* Employee View - Show HR Reply if exists */}
          {!isHROrAdmin && query.hrReply && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="text-sm font-medium text-green-800 mb-1">HR Reply:</div>
              <div className="text-sm text-green-700">{query.hrReply}</div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          
          {isHROrAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onSendReply} disabled={!queryReply.trim()}>
                Send Reply
              </Button>
              {onResolveViaPayroll && (
                <Button
                  variant="outline"
                  onClick={onResolveViaPayroll}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resolve via Payroll
                </Button>
              )}
              <Button
                onClick={onMarkResolved}
                disabled={query.status === "Resolved" || query.status === "Closed"}
              >
                Mark Resolved
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
