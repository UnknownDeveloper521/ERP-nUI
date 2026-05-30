/**
 * ============================================================================
 * PAYSLIPS TAB - HR/ADMIN AND EMPLOYEE VIEWS (AUTO PAYSLIP FLOW)
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useCommonStore } from "@/store/commonStore";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Printer, Eye, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useHasPermission } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { CURRENCY_SYMBOL } from "@/config/appConfig";
import {
  usePayslipsList,
  usePayslipDetail,
  usePayPeriods,
  // useDepartmentsDropdown,
  useCommonEmployees
} from "@/hooks/useApi";
import { payrollApi } from "@/lib/api";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Helper to ensure breakdown components match the prorated list totals.
 */
const getProratedAmount = (amount: number, paidDays: number, periodDays: number) => {
  if (!periodDays || periodDays === 0 || isNaN(paidDays)) return amount;
  return (amount * paidDays) / periodDays;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Payslips() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canView, canPrint } = useHasPermission();
  const hasViewPermission = canView("HRMS:Payroll Management");
  const hasPrintPermission = canPrint("HRMS:Payroll Management");

  // Filter and Search State
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [deptFilterId, setDeptFilterId] = useState<string>("All");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [location] = useLocation();
  const [printingKey, setPrintingKey] = useState<string | null>(null);

  // API Hooks
  const companyDetails = useCommonStore((state) => state.companyDetails);
  const { data: payPeriodsData, refetch: refetchPeriods } = usePayPeriods();
  /*
  const { data: departmentsData, refetch: refetchDepts } = useDepartmentsDropdown();
  const departments = (Array.isArray(departmentsData) ? departmentsData : departmentsData?.data?.records || departmentsData?.data || []) || [];
  */
  const departmentsFromStore = useCommonStore((state) => state.departments);
  const departments = useMemo(
    () =>
      (departmentsFromStore || []).map((d: any) => ({
        ...d,
        name: d.name ?? d.value_name,
        department_name: d.department_name ?? d.value_name ?? d.name,
      })),
    [departmentsFromStore]
  );
  const { data: commonEmployeesData } = useCommonEmployees();


  // Mapping for employee code to ID
  const employeeCodeToIdMap = useMemo(() => {
    const map = new Map<string, number>();
    const records = (commonEmployeesData?.data?.records || []) as any[];
    records.forEach(emp => {
      if (emp.code && emp.id) {
        map.set(emp.code, emp.id);
      }
    });
    return map;
  }, [commonEmployeesData]);

  const payPeriods = (Array.isArray(payPeriodsData) ? payPeriodsData : payPeriodsData?.data?.records || payPeriodsData?.data || []) || [];

  const { data: payslipsListData, isLoading: isListLoading, isFetching: isListFetching, refetch } = usePayslipsList({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearchQuery,
    pay_period_id: selectedPeriodId !== "All" ? parseInt(selectedPeriodId) : undefined,
    department_id: deptFilterId !== "All" ? parseInt(deptFilterId) : undefined,
    refreshKey: location,
  });

  // Fresh data guarantee: 
  // Relying on useQuery with refetchOnMount: 'always' and queryKey change (location) 
  // to ensure data is never stale without manual duplicate calls on mount.
  useEffect(() => {
    // No manual refetch on mount needed as React Query handles it once correctly.
  }, [refetchPeriods]);

  // Pay Period Data Strategy:
  // 1. Fetch all periods from the common dropdown API (standard).
  // 2. Fallback: Some historical or locked periods might only be available in the metadata of the payslips list response.
  // 3. Merge both sources into allPayPeriods to ensure every payslip's period ID can be resolved to a human-readable name.
  const embeddedPeriods = payslipsListData?.data?.pay_periods || payslipsListData?.pay_periods || [];
  const allPayPeriods = [...payPeriods, ...(Array.isArray(embeddedPeriods) ? embeddedPeriods : [])];

  // Mapping for Pay Period Name to ID (MOVED BELOW allPayPeriods)
  const payPeriodNameToIdMap = useMemo(() => {
    const map = new Map<string, number>();
    allPayPeriods.forEach(p => {
      const name = p.period_name || p.name || p.period || p.pay_period_name;
      if (name && p.id) {
        map.set(name, p.id);
      }
    });
    return map;
  }, [allPayPeriods]);

  const rawRecords = (payslipsListData?.data?.records || payslipsListData?.records || []) as any[];
  const pagination = (payslipsListData?.data?.pagination || payslipsListData?.pagination) || { totalCount: rawRecords.length, totalPages: 1 };

  // Safety mapping to ensure IDs are present and records are unique
  const payslips = useMemo(() => {
    const seen = new Set<string>();
    const uniqueRecords: any[] = [];

    rawRecords.forEach(r => {
      // Priority for employee_id: 
      // 1. Explicit employee_id from record
      // 2. Lookup from employee_code (very robust)
      const resolvedId = r.employee_id || (r.employee_code ? employeeCodeToIdMap.get(r.employee_code) : r.id);
      
      // Robust pay_period_id resolution: 
      const resolvedPeriodId = r.pay_period_id || r.payroll_period_id || r.period_id || 
                               (selectedPeriodId !== "All" ? parseInt(selectedPeriodId) : 
                               (r.pay_period || r.pay_period_name ? payPeriodNameToIdMap.get(r.pay_period || r.pay_period_name) : null));
      
      const recordKey = r.payroll_run_id || (r.id ? String(r.id) : `${resolvedId}-${resolvedPeriodId}`);

      if (!seen.has(recordKey)) {
        seen.add(recordKey);
        uniqueRecords.push({
          ...r,
          employee_id: resolvedId,
          pay_period_id: resolvedPeriodId,
          unique_key: recordKey
        });
      }
    });

    return uniqueRecords;
  }, [rawRecords, selectedPeriodId, employeeCodeToIdMap, payPeriodNameToIdMap]);

  // Selected Payslip for Detail Dialog
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);

  /**
   * Resolves a numeric pay_period_id to its human-readable month-year name.
   * Checks multiple field variants (period_name, name, period) to accommodate different backend response structures.
   */
  const resolvePeriodName = (id: any, periods: any[]) => {
    if (!id || !periods || periods.length === 0) return id || "N/A";
    const found = periods.find(p =>
      String(p.id) === String(id) ||
      String(p.period_id) === String(id) ||
      String(p.payroll_period_id) === String(id) ||
      String(p.pay_period_id) === String(id)
    );
    return found?.period_name || found?.name || found?.period || found?.pay_period_name || id;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      "Paid": "bg-green-50 text-green-700 border-green-200",
      "Draft": "bg-yellow-50 text-yellow-700 border-yellow-200",
      "Locked": "bg-blue-50 text-blue-700 border-blue-200",
      "Available": "bg-green-50 text-green-700 border-green-200",
      "Not available": "bg-red-50 text-red-700 border-red-200",
    };

    return (
      <Badge variant="outline" className={cn("font-semibold px-2 py-0.5 text-[10px]", variants[status] || "bg-gray-50 text-gray-500")}>
        {status}
      </Badge>
    );
  };


  const handleDownloadPayslip = async (payslipRow: any) => {
    const actionKey = payslipRow.unique_key || String(payslipRow.id || `${payslipRow.employee_id}-${payslipRow.pay_period_id}`);
    if (printingKey) return;

    setPrintingKey(actionKey);
    const employeeId = Number(payslipRow.employee_id);
    const payPeriodId = Number(payslipRow.pay_period_id);
    let payslip = payslipRow;

    try {
      if (employeeId && payPeriodId) {
        try {
          const res = await payrollApi.getPayslipDetail(employeeId, payPeriodId);
          const detail = res?.data ?? res;
          if (detail) {
            payslip = { ...payslipRow, ...detail };
          }
        } catch (error) {
          console.error("Error fetching payslip detail for print:", error);
          const cachedData = queryClient.getQueryData<{ data: any }>(['payroll', 'payslip-detail', employeeId, payPeriodId]);
          payslip = cachedData?.data || cachedData || payslipRow;
        }
      }

    // Robust Attendance Mapping from Row vs Cached
    const rowPaidDays = parseFloat((payslip.paid_days ?? payslipRow.paid_days ?? payslipRow.paidDays ?? "0").toString());
    const rowPeriodDays = parseFloat((payslip.period_days ?? payslipRow.period_days ?? payslipRow.periodDays ?? "30").toString());
    const rowOTHours = parseFloat((payslip.ot_hours ?? payslipRow.ot_hours ?? payslipRow.otHours ?? "0").toString());
    const rowLWPDays = parseFloat((payslip.lwp_days ?? payslipRow.lwp_days ?? payslipRow.lwpDays ?? "0").toString());

    // Map period name if missing (Robust fallback)
    const periodName = payslip.pay_period || payslip.pay_period_name ||
      resolvePeriodName(payslip.pay_period_id || payslip.payroll_period_id, allPayPeriods);

    // Prepare breakdown data for print
    const earnings = payslip.earnings || [];
    const componentsTotal = earnings.reduce((sum: number, e: any) => sum + (parseFloat((e.amount || e.monthly_amount || 0).toString())), 0);
    const otAmount = parseFloat((payslip.overtime_amount || 0).toString());
    const grossPay = parseFloat((payslip.gross_pay || 0).toString());
    const totalDeductions = parseFloat((payslip.total_deductions || 0).toString());
    const netPay = parseFloat((payslip.net_pay || payslipRow.net_pay || payslipRow.net_salary || 0).toString());

    // Generate Styled HTML for Printing (Standard Black & White Professional)
    const printHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>&#8203;</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    @page { margin: 0; }
    body { font-family: 'Inter', sans-serif; background: #fff; margin: 0; padding: 15mm; color: #000; line-height: 1.5; font-size: 11px; }
    
    .container { max-width: 800px; margin: 0 auto; padding: 0; }
    
    .header { text-align: center; margin-bottom: 20px; }
    .company-name { font-size: 24px; font-weight: 700; color: #000; margin-bottom: 2px; }
    .company-address { font-size: 11px; font-weight: 500; color: #4b5563; margin-bottom: 8px; max-width: 500px; margin-left: auto; margin-right: auto; }
    .payslip-title { font-size: 15px; font-weight: 600; color: #000; margin-top: 4px; }
    .header-divider { height: 2px; background: #000; margin-bottom: 25px; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 60px; margin-bottom: 30px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 10px; font-weight: 600; color: #4b5563; text-transform: none; }
    .info-value { font-size: 13px; font-weight: 600; color: #000; }
    
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 30px; }
    .summary-card { border: 1px solid #000; padding: 16px 12px; border-radius: 4px; text-align: center; background: #fff; }
    .summary-label { font-size: 9px; font-weight: 600; color: #4b5563; text-transform: none; margin-bottom: 8px; }
    .summary-value { font-size: 18px; font-weight: 700; color: #000; }
    
    .tables-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
    .table-container { flex: 1; }
    .table-title { font-size: 13px; font-weight: 700; color: #000; margin-bottom: 15px; display: inline-block; }
    .amount-header { font-size: 13px; font-weight: 700; color: #000; float: right; }
    .clearfix::after { content: ""; clear: both; display: table; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    td { font-size: 12px; padding: 10px 0; color: #000; border-bottom: 1px dotted #ccc; }
    td:first-child { font-weight: 500; }
    .amount { text-align: right; font-weight: 500; color: #000; }
    
    .total-row { padding: 8px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; }
    .total-label { font-size: 12px; font-weight: 700; color: #000; }
    .total-value { font-size: 12px; font-weight: 700; color: #000; }
    
    .gross-pay-row { border-top: 2px solid #000; padding: 12px 5px; display: flex; justify-content: space-between; align-items: center; margin-top: 5px; }
    .gross-label { font-size: 13px; font-weight: 800; color: #000; text-transform: uppercase; }
    .gross-value { font-size: 13px; font-weight: 800; color: #000; }
    
    .net-pay-box { border: 2px solid #000; border-radius: 4px; padding: 25px; text-align: center; margin: 20px 0 40px 0; background: #fff; }
    .net-pay-label { font-size: 14px; font-weight: 700; color: #000; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .net-pay-value { font-size: 34px; font-weight: 800; color: #000; letter-spacing: -0.02em; }
    
    .footer-note { text-align: center; font-size: 11px; color: #4b5563; margin-top: 60px; line-height: 1.6; }
    .generated-date { margin-top: 8px; font-size: 11px; }
    
    @media print {
      .container { border: none; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-name">${companyDetails?.company_name || "Tassos Consultancy Services"}</div>
      ${companyDetails?.company_address ? `<div class="company-address">${companyDetails.company_address}</div>` : ''}
      <div class="payslip-title">Payslip for ${periodName}</div>
    </div>
    <div class="header-divider"></div>
    
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Employee Code</span>
        <span class="info-value">${payslip.employee_code || payslipRow.employee_code}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Department</span>
        <span class="info-value">${payslip.department_name || payslipRow.department_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Employee Name</span>
        <span class="info-value">${payslip.employee_name || payslipRow.employee_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Pay Period</span>
        <span class="info-value">${periodName}</span>
      </div>
    </div>
    
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Paid Days</div>
        <div class="summary-value">${rowPaidDays}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">OT Hours</div>
        <div class="summary-value">${rowOTHours}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">LWP Days</div>
        <div class="summary-value">${rowLWPDays}</div>
      </div>
    </div>
    
    <div class="tables-section">
      <!-- Earnings -->
      <div class="table-container">
        <div class="clearfix">
          <span class="table-title">Earnings</span>
          <span class="amount-header">Amount (${CURRENCY_SYMBOL})</span>
        </div>
        <table>
          <tbody>
            ${(earnings.length > 0
              ? earnings.map((e: any) => `
                <tr>
                  <td>${e.component_name}</td>
                  <td class="amount">${(parseFloat((e.amount || e.monthly_amount || 0).toString())).toLocaleString()}</td>
                </tr>
              `)
              : [`
                <tr>
                  <td>Basic Salary</td>
                  <td class="amount">${grossPay.toLocaleString()}</td>
                </tr>
              `]
            ).join('')}
          </tbody>
        </table>
        
        <div class="total-row">
          <span class="total-label">Total Earnings</span>
          <span class="total-value">${CURRENCY_SYMBOL}${componentsTotal.toLocaleString()}</span>
        </div>
        <div class="total-row" style="border-bottom: none;">
          <span class="total-label" style="font-weight: 500;">Overtime</span>
          <span class="total-value" style="font-weight: 500;">${CURRENCY_SYMBOL}${otAmount.toLocaleString()}</span>
        </div>
        <div class="gross-pay-row">
          <span class="gross-label">Gross Pay</span>
          <span class="gross-value">${CURRENCY_SYMBOL}${grossPay.toLocaleString()}</span>
        </div>
      </div>
      
      <!-- Deductions -->
      <div class="table-container">
        <div class="clearfix">
          <span class="table-title">Deductions</span>
          <span class="amount-header">Amount (${CURRENCY_SYMBOL})</span>
        </div>
        <table>
          <tbody>
            ${(payslip.deductions && payslip.deductions.length > 0
              ? payslip.deductions.map((d: any) => `
                <tr>
                  <td>${d.component_name}</td>
                  <td class="amount">${(parseFloat((d.amount || d.monthly_amount || 0).toString())).toLocaleString()}</td>
                </tr>
              `)
              : [`
                <tr>
                  <td>General Deductions</td>
                  <td class="amount">${totalDeductions.toLocaleString()}</td>
                </tr>
              `]
            ).join('')}
          </tbody>
        </table>
        <div class="total-row" style="margin-top: 10px;">
          <span class="total-label">Total Deductions</span>
          <span class="total-value">${CURRENCY_SYMBOL}${totalDeductions.toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="net-pay-box">
      <div class="net-pay-label">Net Pay</div>
      <div class="net-pay-value">${CURRENCY_SYMBOL}${netPay.toLocaleString()}</div>
    </div>
    
    <div class="footer-note">
      This is a computer-generated payslip and does not require a signature.
      <div class="generated-date">Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}</div>
    </div>
  </div>
</body>
</html>
`;

    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      if ('open' in doc) doc.open();
      if ('write' in doc) doc.write(printHTML);
      if ('close' in doc) doc.close();

      // Wait for resources to load if any, then print
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        // Remove the iframe after printing dialog is closed
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
    } catch (error) {
      console.error("Error printing payslip:", error);
      toast({
        title: "Error",
        description: "Failed to print payslip. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPrintingKey(null);
    }
  };

  const isTableLoading = isListLoading || isListFetching;
  const isActionBusy = isTableLoading || printingKey !== null;

  return (
    <div className="space-y-6">
      <AppListToolbar
        search={{
          value: searchQuery,
          onChange: (val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          },
          placeholder: "Search employees..."
        }}
        filters={[
          {
            type: 'select',
            label: 'PAY PERIOD',
            value: selectedPeriodId === "All" ? "All Periods" : (allPayPeriods.find((p: any) => p.id.toString() === selectedPeriodId)?.period_name || allPayPeriods.find((p: any) => p.id.toString() === selectedPeriodId)?.name || allPayPeriods.find((p: any) => p.id.toString() === selectedPeriodId)?.period || "All Periods"),
            options: ["All Periods", ...(Array.isArray(allPayPeriods) ? allPayPeriods.map((p: any) => p?.period_name || p?.name || p?.period).filter(Boolean) : [])],
            onChange: (val) => {
              setCurrentPage(1);
              if (val === "All Periods") setSelectedPeriodId("All");
              else if (Array.isArray(allPayPeriods)) {
                const p = allPayPeriods.find((p: any) => (p.period_name || p.name || p.period) === val);
                if (p) setSelectedPeriodId(p.id.toString());
              }
            },
            searchable: true
          },
          {
            type: 'select',
            label: 'DEPARTMENT',
            value: deptFilterId === "All" ? "All Departments" : (departments.find((d: any) => d.id.toString() === deptFilterId)?.name || departments.find((d: any) => d.id.toString() === deptFilterId)?.department_name || "All Departments"),
            options: ["All Departments", ...(Array.isArray(departments) ? departments.map((d: any) => d?.name || d?.department_name).filter(Boolean) : [])],
            onChange: (val) => {
              setCurrentPage(1);
              if (val === "All Departments") setDeptFilterId("All");
              else if (Array.isArray(departments)) {
                const d = departments.find((d: any) => (d.name || d.department_name) === val);
                if (d) setDeptFilterId(d.id.toString());
              }
            },
            searchable: true
          }
        ]}
      />

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="rounded-md border mb-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Employee Code</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Period</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Gross Pay</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Deductions</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Net Pay</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Payroll Status</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Payslip Availability</TableHead>
                  <TableHead className="py-2 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isTableLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : payslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      No data found
                    </TableCell>
                  </TableRow>
                ) : (
                  payslips.map((payslip: any) => {
                    const periodName = payslip.pay_period || payslip.pay_period_name || payslip.period_name ||
                      resolvePeriodName(payslip.pay_period_id || payslip.payroll_period_id, allPayPeriods);
                    const isDraft = payslip.payroll_status === "Draft";
                    const rowKey = payslip.unique_key || payslip.id || `${payslip.employee_id}-${payslip.pay_period_id}`;
                    const isRowPrinting = printingKey === rowKey;

                    return (
                      <TableRow key={rowKey} className="hover:bg-muted/30 transition-colors border-b last:border-0 group">
                        <TableCell className="py-2 px-4 font-medium text-gray-900">{payslip.employee_code}</TableCell>
                        <TableCell className="py-2 px-4 text-gray-700">{payslip.employee_name}</TableCell>
                        <TableCell className="py-2 px-4 text-gray-600">{periodName}</TableCell>
                        <TableCell className="py-2 px-4 text-right font-medium text-gray-700">{CURRENCY_SYMBOL}{(payslip.gross_pay || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-2 px-4 text-right font-medium text-gray-700">{CURRENCY_SYMBOL}{(payslip.total_deductions || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-2 px-4 text-right font-bold text-gray-900">{CURRENCY_SYMBOL}{(payslip.net_pay || payslip.net_salary || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-2 px-4">{getStatusBadge(payslip.payroll_status)}</TableCell>
                        <TableCell className="py-2 px-4">{getStatusBadge(isDraft ? "Not available" : "Available")}</TableCell>
                        <TableCell className="py-2 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            {hasViewPermission && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isActionBusy || isDraft}
                                className={cn(
                                  "h-8 w-8 text-gray-400 transition-all rounded-full",
                                  isDraft ? "cursor-not-allowed opacity-50" : "hover:text-blue-600"
                                )}
                                onClick={() => {
                                  if (isActionBusy) return;
                                  if (isDraft) {
                                    toast({
                                      title: "View Restricted",
                                      description: "This payslip is in draft and details are not yet available.",
                                      variant: "default"
                                    });
                                  } else {
                                    setSelectedPayslip(payslip);
                                  }
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {hasPrintPermission && (
                              <Button
                                variant="ghost"
                                size="icon"
                                loading={isRowPrinting}
                                disabled={isActionBusy || isDraft}
                                className={cn(
                                  "h-8 w-8 text-gray-400 transition-all rounded-full",
                                  isDraft ? "cursor-not-allowed opacity-50" : "hover:text-emerald-600"
                                )}
                                onClick={() => {
                                  if (isActionBusy) return;
                                  if (isDraft) {
                                    toast({
                                      title: "Print Restricted",
                                      description: "This payslip is in draft and not yet available for printing.",
                                      variant: "default"
                                    });
                                  } else {
                                    handleDownloadPayslip(payslip);
                                  }
                                }}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </CardContent>
      </Card>

      {selectedPayslip && (
        <PayslipDetailDialog
          payslipRow={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          getStatusBadge={getStatusBadge}
          payPeriods={allPayPeriods}
        />
      )}
    </div>
  );
}

// ============================================================================
// PAYSLIP DETAIL DIALOG COMPONENT
// ============================================================================

function PayslipDetailDialog({
  payslipRow,
  onClose,
  getStatusBadge,
  payPeriods,
}: {
  payslipRow: any;
  onClose: () => void;
  getStatusBadge: (status: string) => React.ReactElement;
  payPeriods: any[];
}) {
  const { data: detailData, isLoading } = usePayslipDetail(payslipRow.employee_id, payslipRow.pay_period_id);
  const payslip = detailData?.data || detailData;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <div>
              <DialogTitle className="text-lg font-bold text-gray-800">Payslip Details</DialogTitle>
              <div className="text-[11px] font-medium text-gray-500 mt-0.5">
                {payslipRow?.employee_name} - {
                  payslipRow?.pay_period_name ||
                  payPeriods.find((p: any) => Number(p.id) === Number(payslipRow.pay_period_id))?.name ||
                  payPeriods.find((p: any) => Number(p.id) === Number(payslipRow.pay_period_id))?.period ||
                  ""
                }
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : !payslip ? (
              <div className="py-20 text-center text-muted-foreground">No data found</div>
            ) : (
              <>
                {/* Employee Info Bar */}
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 p-4 bg-gray-50/50 rounded-lg border border-gray-100">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-0.5">Employee Code</div>
                    <div className="text-sm font-semibold text-gray-800">{payslipRow.employee_code}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-0.5">Department</div>
                    <div className="text-sm font-semibold text-gray-800">{payslipRow.department_name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-0.5">Payroll Status</div>
                    <div>{getStatusBadge(payslipRow.payroll_status)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-0.5">Payslip Availability</div>
                    <div>{getStatusBadge("Available")}</div>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Paid Days", value: payslip?.paid_days ?? payslipRow.paid_days ?? payslipRow.paidDays ?? 0, color: "text-gray-700 font-semibold" },
                    { label: "OT Hours", value: payslip?.ot_hours ?? payslipRow.ot_hours ?? payslipRow.otHours ?? 0, color: "text-gray-700 font-semibold" },
                    { label: "LWP Days", value: payslip?.lwp_days ?? payslipRow.lwp_days ?? payslipRow.lwpDays ?? 0, color: "text-gray-700 font-semibold" },
                  ].map((metric) => (
                    <Card key={metric.label} className="shadow-none border border-gray-100 bg-white">
                      <CardContent className="p-4">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-1">{metric.label}</div>
                        <div className={cn("text-xl", metric.color)}>{metric.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Tables Section */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Earnings */}
                  <div className="space-y-2">
                    <h3 className="text-[13px] font-bold text-green-700 px-1">Earnings</h3>
                    <div className="border border-gray-100 rounded-md overflow-hidden">
                      <Table>
                        <TableHeader className="bg-[#f3f9f4] border-b border-[#e5e7eb]">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-8 text-[10px] uppercase font-bold text-green-700/70">Component</TableHead>
                            <TableHead className="h-8 text-[10px] uppercase font-bold text-green-700/70 text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const components = (payslip?.earnings || []);
                            const componentsTotal = components.reduce((sum: number, e: any) => sum + (parseFloat((e.amount || e.monthly_amount || 0).toString())), 0);
                            const otAmount = parseFloat((payslip?.overtime_amount || 0).toString());
                            const grossPay = parseFloat((payslip?.gross_pay || 0).toString());

                            return (
                              <>
                                {components.map((e: any, idx: number) => (
                                  <TableRow key={`${e.component_name}-${idx}`} className="h-8 border-b border-[#e5e7eb] last:border-0">
                                    <TableCell className="py-1.5 text-[11px] font-medium text-gray-700">{e.component_name}</TableCell>
                                    <TableCell className="py-1.5 text-[11px] font-bold text-gray-800 text-right">{CURRENCY_SYMBOL}{(parseFloat((e.amount || e.monthly_amount || 0).toString())).toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-[#f3f9f4]/50 border-t border-[#e5e7eb]">
                                  <TableCell className="py-1.5 text-[11px] font-bold text-green-700">Total Earnings</TableCell>
                                  <TableCell className="py-1.5 text-[11px] font-bold text-green-700 text-right">{CURRENCY_SYMBOL}{componentsTotal.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow className="border-t border-[#e5e7eb]">
                                  <TableCell className="py-1.5 text-[11px] font-medium text-gray-700">Overtime</TableCell>
                                  <TableCell className="py-1.5 text-[11px] font-bold text-gray-800 text-right">{CURRENCY_SYMBOL}{otAmount.toLocaleString()}</TableCell>
                                </TableRow>
                                <TableRow className="bg-[#f3f9f4] border-t-2 border-green-200">
                                  <TableCell className="py-2 text-[11px] font-extrabold text-green-800 uppercase tracking-tight">Gross Pay</TableCell>
                                  <TableCell className="py-2 text-[11px] font-extrabold text-green-800 text-right">{CURRENCY_SYMBOL}{grossPay.toLocaleString()}</TableCell>
                                </TableRow>
                              </>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="space-y-2">
                    <h3 className="text-[13px] font-bold text-red-700 px-1">Deductions</h3>
                    <div className="border border-gray-100 rounded-md overflow-hidden">
                      <Table>
                        <TableHeader className="bg-[#fdf2f2] border-b border-[#e5e7eb]">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-8 text-[10px] uppercase font-bold text-red-700/70">Component</TableHead>
                            <TableHead className="h-8 text-[10px] uppercase font-bold text-red-700/70 text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const deductionsList = (payslip?.deductions || []);
                            const totalDeductions = parseFloat((payslip?.total_deductions || 0).toString());

                            return (
                              <>
                                {deductionsList.map((d: any, idx: number) => (
                                  <TableRow key={`${d.component_name}-${idx}`} className="h-8 border-b border-[#e5e7eb] last:border-0">
                                    <TableCell className="py-1.5 text-[11px] font-medium text-gray-700">{d.component_name}</TableCell>
                                    <TableCell className="py-1.5 text-[11px] font-bold text-gray-800 text-right">{CURRENCY_SYMBOL}{(parseFloat((d.amount || d.monthly_amount || 0).toString())).toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-[#fdf2f2] border-t border-[#e5e7eb]">
                                  <TableCell className="py-2 text-[11px] font-bold text-red-700">Total Deductions</TableCell>
                                  <TableCell className="py-2 text-[11px] font-bold text-red-700 text-right">{CURRENCY_SYMBOL}{totalDeductions.toLocaleString()}</TableCell>
                                </TableRow>
                              </>
                            );
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                {/* Net Pay Bar */}
                <div className="flex justify-between items-center px-6 py-4 bg-emerald-50 border border-emerald-200 rounded-lg mt-4 shadow-sm">
                  <span className="text-[13px] font-bold text-emerald-900 uppercase tracking-wider">Net Pay</span>
                  <span className="text-3xl font-extrabold text-emerald-700 tracking-tight">{CURRENCY_SYMBOL}{(payslip?.net_pay ?? payslipRow.net_pay ?? payslipRow.net_salary ?? 0).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer Close Button */}
          <div className="px-6 py-2.5 flex justify-end gap-2 border-t bg-gray-50/50">
            <Button onClick={onClose} className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] h-7 shadow-sm transition-all active:scale-95">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
