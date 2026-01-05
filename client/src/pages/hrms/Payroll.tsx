import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, FileText, Download, Upload, Filter, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Payroll() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("summary");
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock Payroll Data
  const [payrollData, setPayrollData] = useState([
    { id: 1, name: "Sarah Johnson", role: "Senior Developer", month: "November 2025", basic: 50000, hra: 25000, allowances: 10000, deductions: 5000, net: 80000, status: "Paid" },
    { id: 2, name: "Michael Chen", role: "Product Manager", month: "November 2025", basic: 60000, hra: 30000, allowances: 15000, deductions: 6000, net: 99000, status: "Pending" },
    { id: 3, name: "Jessica Williams", role: "HR Specialist", month: "November 2025", basic: 40000, hra: 20000, allowances: 8000, deductions: 3000, net: 65000, status: "Paid" },
  ]);

  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  const handleRunPayroll = () => {
    setIsProcessing(true);
    toast({ title: "Processing Payroll", description: "Calculating deductions and taxes..." });
    
    setTimeout(() => {
        setPayrollData(prev => prev.map(p => ({ ...p, status: "Paid" })));
        setIsProcessing(false);
        toast({ title: "Success", description: "Payroll run completed successfully." });
    }, 2000);
  };

  const handleImport = () => {
    toast({ title: "Import Data", description: "File picker would open here." });
  };

  const handleExport = () => {
    toast({ title: "Export Data", description: "Downloading payroll report..." });
  };

  const handleDetails = (record: any) => {
    setSelectedPayslip(record);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">Manage salaries, payslips, and tax deductions.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleImport}>
                <Upload className="mr-2 h-4 w-4" /> Import Data
            </Button>
            <Button onClick={handleRunPayroll} disabled={isProcessing}>
                <Calculator className={`mr-2 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} /> 
                {isProcessing ? "Processing..." : "Run Payroll"}
            </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Payroll Cost</p>
              <h3 className="text-2xl font-bold text-green-900">$244,000</h3>
              <p className="text-xs text-green-600/80 mt-1">For Nov 2025</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Employees Paid</p>
              <h3 className="text-2xl font-bold">142/150</h3>
              <p className="text-xs text-muted-foreground mt-1">8 Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tax Deducted (TDS)</p>
              <h3 className="text-2xl font-bold">$24,500</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
           <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Claims</p>
              <h3 className="text-2xl font-bold">12</h3>
              <p className="text-xs text-muted-foreground mt-1">Reimbursements</p>
            </div>
           </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="summary">Payroll Summary</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="structure">Salary Structure</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
             <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Monthly Payroll Roll</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-2" /> Filter</Button>
                    <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" /> Export</Button>
                </div>
             </CardHeader>
             <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Month</TableHead>
                            <TableHead>Basic Salary</TableHead>
                            <TableHead>Earnings</TableHead>
                            <TableHead>Deductions</TableHead>
                            <TableHead>Net Pay</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payrollData.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell>
                                    <div className="font-medium">{record.name}</div>
                                    <div className="text-xs text-muted-foreground">{record.role}</div>
                                </TableCell>
                                <TableCell>{record.month}</TableCell>
                                <TableCell>${record.basic.toLocaleString()}</TableCell>
                                <TableCell className="text-green-600">+${(record.hra + record.allowances).toLocaleString()}</TableCell>
                                <TableCell className="text-red-600">-${record.deductions.toLocaleString()}</TableCell>
                                <TableCell className="font-bold">${record.net.toLocaleString()}</TableCell>
                                <TableCell><Badge variant={record.status === "Paid" ? "default" : "secondary"}>{record.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => handleDetails(record)}>Details</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card>
            <CardHeader>
              <CardTitle>Payslip Generation</CardTitle>
              <CardDescription>View and download individual employee payslips.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {payrollData.map((data) => (
                  <Card key={data.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedPayslip(data)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-500 bg-blue-100 p-1.5 rounded" />
                        <div>
                          <p className="font-medium">{data.name}</p>
                          <p className="text-xs text-muted-foreground">{data.month}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="structure">
            <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                    <p>Salary structure configuration goes here.</p>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPayslip} onOpenChange={(open) => !open && setSelectedPayslip(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payslip Detail - {selectedPayslip?.month}</DialogTitle>
            <DialogDescription>Payslip for {selectedPayslip?.name} ({selectedPayslip?.role})</DialogDescription>
          </DialogHeader>
          {selectedPayslip && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="font-semibold text-green-700 border-b pb-1">Earnings</h4>
                  <div className="flex justify-between text-sm">
                    <span>Basic Salary</span>
                    <span>${selectedPayslip.basic.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>HRA</span>
                    <span>${selectedPayslip.hra.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Allowances</span>
                    <span>${selectedPayslip.allowances.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total Earnings</span>
                    <span>${(selectedPayslip.basic + selectedPayslip.hra + selectedPayslip.allowances).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-red-700 border-b pb-1">Deductions</h4>
                  <div className="flex justify-between text-sm">
                    <span>Income Tax (TDS)</span>
                    <span>${(selectedPayslip.deductions * 0.6).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Provident Fund</span>
                    <span>${(selectedPayslip.deductions * 0.4).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total Deductions</span>
                    <span>${selectedPayslip.deductions.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
                <span className="font-medium">Net Pay</span>
                <span className="text-xl font-bold">${selectedPayslip.net.toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPayslip(null)}>Close</Button>
            <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
