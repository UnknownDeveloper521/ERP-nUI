import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import { Printer, ChevronLeft, ChevronRight, AlertCircle, ChevronsUpDown, Check, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { mockPayPeriods, MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES } from "@/lib/payrollSharedData";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type PayrollStatus = "Draft" | "Calculated" | "Locked";
type PayslipAvailability = "Available" | "Not Ready";

interface Payslip {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  payPeriodId: string;
  periodName: string;
  payrollStatus: PayrollStatus;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  paidDays: number;
  otHours: number;
  lwpDays: number;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
}

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================



// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EmployeePayslip() {
  const { toast } = useToast();

  // Employee ID for currently logged in (simulated) user
  const currentEmployeeId = "emp-001";

  // Data derivation
  const allPayslips = useMemo(() => {
    return MOCK_PAYROLL_RUNS.map(run => {
      const employee = MOCK_EMPLOYEES.find(e => e.id === run.employeeId);
      const period = mockPayPeriods.find(p => p.id === run.payPeriodId);

      return {
        id: run.id,
        employeeId: run.employeeId,
        employeeCode: employee?.code || "N/A",
        employeeName: employee?.name || "Unknown",
        department: employee?.department || "N/A",
        payPeriodId: run.payPeriodId,
        periodName: period?.periodName || "N/A",
        payrollStatus: run.status as any,
        grossPay: run.grossPay,
        totalDeductions: run.totalDeductions,
        netPay: run.netPay,
        paidDays: run.paidDays,
        otHours: run.otHours,
        lwpDays: run.lwpDays,
        earnings: run.earnings || [],
        deductions: run.deductions || []
      } as Payslip;
    });
  }, []);

  // Filter state
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const filteredPayslips = useMemo(() => {
    // Show only for current employee
    let filtered = allPayslips.filter(p => p.employeeId === currentEmployeeId);

    if (selectedPeriodId !== "all") {
      filtered = filtered.filter((p) => p.payPeriodId === selectedPeriodId);
    }

    return filtered;
  }, [allPayslips, selectedPeriodId]);

  const totalPages = Math.ceil(filteredPayslips.length / itemsPerPage);
  const paginatedPayslips = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayslips.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayslips, currentPage]);

  // Handlers
  const getPayslipAvailability = (payrollStatus: PayrollStatus): PayslipAvailability => {
    return payrollStatus === "Locked" ? "Available" : "Not Ready";
  };

  const getStatusBadge = (status: PayrollStatus | PayslipAvailability) => {
    const variants: Record<string, string> = {
      Draft: "bg-gray-100 text-gray-800",
      Calculated: "bg-blue-100 text-blue-800",
      Locked: "bg-green-100 text-green-800",
      Available: "bg-green-100 text-green-800",
      "Not Ready": "bg-yellow-100 text-yellow-800",
    };

    return (
      <Badge className={cn("font-medium", variants[status] || "")}>
        {status}
      </Badge>
    );
  };

  const handleViewPayslip = (payslip: Payslip) => {
    if (payslip.payrollStatus !== "Locked") {
      toast({
        title: "Payslip Not Available",
        description: "Payslip is not available yet. Payroll is not locked for this period.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPayslip(payslip);
  };

  const handleDownloadPayslip = (payslip: Payslip) => {
    // Reusing the print logic from Payslips.tsx
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
      <div class="summary-value">USh${payslip.grossPay.toLocaleString()}</div>
    </div>
  </div>

  <div class="tables-section">
    <div>
      <table>
        <thead>
          <tr class="earnings-header">
            <th>Earnings</th>
            <th style="text-align: right;">Amount (USh)</th>
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
            <td style="text-align: right;">USh${(payslip?.grossPay ?? 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead>
          <tr class="deductions-header">
            <th>Deductions</th>
            <th style="text-align: right;">Amount (USh)</th>
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
            <td style="text-align: right;">USh${(payslip?.totalDeductions ?? 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-pay-section">
    <div class="net-pay-label">Net Pay</div>
    <div class="net-pay-value">USh${payslip.netPay.toLocaleString()}</div>
  </div>

  <div class="footer">
    <p>This is a computer-generated payslip and does not require a signature.</p>
    <p>Generated on ${format(new Date(), 'dd-MM-yyyy')}</p>
  </div>
</body>
</html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(payslipHTML);
      iframeDoc.close();

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 250);
      };
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Employee Payslip</h1>
        <p className="text-muted-foreground text-sm">View and download your monthly payslips</p>
      </div>

      <AppListToolbar
        filters={[
          {
            type: 'select',
            label: 'Pay Period',
            value: selectedPeriodId === "all" ? "All Periods" : mockPayPeriods.find(p => p.id === selectedPeriodId)?.periodName || "All Periods",
            options: ["All Periods", ...mockPayPeriods.map(period => period.periodName)],
            onChange: (value) => {
              if (value === "All Periods") {
                setSelectedPeriodId("all");
              } else {
                const period = mockPayPeriods.find(p => p.periodName === value);
                if (period) setSelectedPeriodId(period.id);
              }
            },
            searchable: true
          }
        ]}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[150px]">Period</TableHead>
                  <TableHead>Payroll Status</TableHead>
                  <TableHead>Payslip Availability</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPayslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                      No payslips found for your account.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayslips.map((payslip) => {
                    const availability = getPayslipAvailability(payslip.payrollStatus);
                    const isAvailable = payslip.payrollStatus === "Locked";

                    return (
                      <TableRow key={payslip.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-sm">{payslip.periodName}</TableCell>
                        <TableCell>{getStatusBadge(payslip.payrollStatus)}</TableCell>
                        <TableCell>{getStatusBadge(availability)}</TableCell>
                        <TableCell>
                          {!isAvailable ? (
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm">Not Ready</span>
                            </div>
                          ) : (
                            <TableActionButtons
                              onView={() => handleViewPayslip(payslip)}
                              customActions={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={() => handleDownloadPayslip(payslip)}
                                  title="Print"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              }
                            />
                          )}
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
            totalPages={totalPages}
            totalItems={filteredPayslips.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </CardContent>
      </Card>


      {selectedPayslip && (
        <PayslipDetailDialog
          payslip={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          getStatusBadge={getStatusBadge}
          getPayslipAvailability={getPayslipAvailability}
        />
      )}
    </div>
  );
}

// ============================================================================
// PAYSLIP DETAIL DIALOG COMPONENT
// ============================================================================

interface PayslipDetailDialogProps {
  payslip: Payslip | null;
  onClose: () => void;
  getStatusBadge: (status: PayrollStatus | PayslipAvailability) => React.ReactElement;
  getPayslipAvailability: (payrollStatus: PayrollStatus) => PayslipAvailability;
}

function PayslipDetailDialog({
  payslip,
  onClose,
  getStatusBadge,
  getPayslipAvailability,
}: PayslipDetailDialogProps) {
  if (!payslip) return null;

  const availability = getPayslipAvailability(payslip.payrollStatus);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip Details</DialogTitle>
          <DialogDescription>
            {payslip?.employeeName} - {payslip?.periodName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
              <div>{getStatusBadge(payslip.payrollStatus)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Payslip Availability</div>
              <div>{getStatusBadge(availability)}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Card className="shadow-none border-gray-100">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Paid Days</div>
                <div className="text-2xl font-bold">{payslip?.paidDays}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-gray-100">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">OT Hours</div>
                <div className="text-2xl font-bold">{payslip?.otHours}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-gray-100">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">LWP Days</div>
                <div className="text-2xl font-bold">{payslip?.lwpDays}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-gray-100">
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Net Pay</div>
                <div className="text-2xl font-bold text-green-600">
                  USh{payslip?.netPay.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 text-green-700">Earnings</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-50/50">
                      <TableHead className="font-semibold">Component</TableHead>
                      <TableHead className="font-semibold text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslip?.earnings.map((earning, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{earning.name}</TableCell>
                        <TableCell className="text-right">
                          USh{earning.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-green-50/50 font-semibold">
                      <TableCell>Total Earnings</TableCell>
                      <TableCell className="text-right">
                        USh{payslip?.grossPay.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-red-700">Deductions</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50/50">
                      <TableHead className="font-semibold">Component</TableHead>
                      <TableHead className="font-semibold text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslip?.deductions.map((deduction, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{deduction.name}</TableCell>
                        <TableCell className="text-right">
                          USh{deduction.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-red-50/50 font-semibold">
                      <TableCell>Total Deductions</TableCell>
                      <TableCell className="text-right">
                        USh{payslip?.totalDeductions.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Net Salary</span>
              <span className="text-2xl font-bold text-blue-600">
                USh{payslip?.netPay.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
