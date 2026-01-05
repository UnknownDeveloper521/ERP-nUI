import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Download, Plus, FileText, TrendingUp, DollarSign, Tractor, Factory, Truck, Scale } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Mock Data for Sugar Factory Accounting
const revenueData = [
  { month: "Oct", sugar: 450000, molasses: 120000, bagasse: 50000 },
  { month: "Nov", sugar: 520000, molasses: 135000, bagasse: 60000 },
  { month: "Dec", sugar: 680000, molasses: 180000, bagasse: 75000 },
  { month: "Jan", sugar: 710000, molasses: 190000, bagasse: 80000 },
  { month: "Feb", sugar: 650000, molasses: 175000, bagasse: 70000 },
  { month: "Mar", sugar: 590000, molasses: 160000, bagasse: 65000 },
];

const initialTransactions = [
  { id: "INV-2024-001", date: "2024-03-15", description: "Sugar Sales - Global Traders", amount: 250000.00, type: "Income", status: "Paid", category: "Sugar Sales" },
  { id: "PAY-F-1023", date: "2024-03-14", description: "Cane Payment - Patil Farms", amount: 45000.00, type: "Expense", status: "Processed", category: "Cane Procurement" },
  { id: "INV-2024-002", date: "2024-03-12", description: "Molasses Sales - Ethanol Corp", amount: 180000.00, type: "Income", status: "Pending", category: "Molasses Sales" },
  { id: "PAY-T-5012", date: "2024-03-10", description: "Transport Charges - Sharma Logistics", amount: 12000.00, type: "Expense", status: "Cleared", category: "Transport & Freight" },
  { id: "INV-2024-003", date: "2024-03-08", description: "Bagasse Sales - Power Gen Ltd", amount: 90000.00, type: "Income", status: "Paid", category: "Bagasse Sales" },
  { id: "PAY-S-2045", date: "2024-03-05", description: "Chemical Supplies - ChemIndia", amount: 28000.00, type: "Expense", status: "Cleared", category: "Production Chemicals" },
];

export default function Accounting() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    description: "",
    amount: "",
    type: "Income",
    status: "Pending",
    category: "General"
  });

  const handleAddTransaction = () => {
    // VALIDATION: Check all required fields
    if (!newTransaction.description || !newTransaction.description.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a description"
      });
      return;
    }

    if (!newTransaction.amount || parseFloat(newTransaction.amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid amount greater than $0"
      });
      return;
    }

    const id = `TRX-${Math.floor(Math.random() * 1000)}`;
    const date = new Date().toISOString().split('T')[0];
    const amount = parseFloat(newTransaction.amount) || 0;
    
    const transaction = {
      id,
      date,
      description: newTransaction.description,
      amount,
      type: newTransaction.type,
      status: newTransaction.status,
      category: newTransaction.category
    };

    setTransactions([transaction, ...transactions]);
    setIsNewTransactionOpen(false);
    setNewTransaction({ description: "", amount: "", type: "Income", status: "Pending", category: "General" });
    
    toast({
      title: "Transaction Recorded",
      description: `Successfully recorded ${newTransaction.category} of $${amount.toLocaleString()}`,
    });
  };

  const handleExportReport = (reportType: string) => {
    // Create a CSV string from the transactions
    const headers = ["ID", "Date", "Description", "Type", "Category", "Status", "Amount"];
    const csvRows = [headers.join(",")];

    transactions.forEach(tx => {
      const row = [
        tx.id,
        tx.date,
        `"${tx.description}"`,
        tx.type,
        tx.category,
        tx.status,
        tx.amount.toFixed(2)
      ];
      csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.href = url;
    link.download = `${reportType.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Report Generated",
      description: `${reportType} has been downloaded successfully.`,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Sugar Factory Accounting</h1>
            <p className="text-muted-foreground">Comprehensive financial management for sugar manufacturing unit.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => handleExportReport("Financial Statement")}>
              <Download className="h-4 w-4" /> Reports
            </Button>
            <Dialog open={isNewTransactionOpen} onOpenChange={setIsNewTransactionOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Record Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Record Financial Entry</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">Entry Type</Label>
                    <Select 
                      value={newTransaction.type} 
                      onValueChange={(value) => setNewTransaction({...newTransaction, type: value})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Income">Income (Sales/Receipts)</SelectItem>
                        <SelectItem value="Expense">Expense (Payments)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">Category</Label>
                    <Select 
                      value={newTransaction.category} 
                      onValueChange={(value) => setNewTransaction({...newTransaction, category: value})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {newTransaction.type === "Income" ? (
                          <>
                            <SelectItem value="Sugar Sales">Sugar Sales</SelectItem>
                            <SelectItem value="Molasses Sales">Molasses Sales</SelectItem>
                            <SelectItem value="Bagasse Sales">Bagasse Sales</SelectItem>
                            <SelectItem value="Press-mud Sales">Press-mud Sales</SelectItem>
                            <SelectItem value="Power Export">Power Export / Cogeneration</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="Cane Procurement">Cane Procurement (Farmers)</SelectItem>
                            <SelectItem value="Transport & Freight">Transport & Freight</SelectItem>
                            <SelectItem value="Production Chemicals">Production Chemicals</SelectItem>
                            <SelectItem value="Maintenance">Maintenance & Engineering</SelectItem>
                            <SelectItem value="Labor Contractor">Labor Contractor Payments</SelectItem>
                            <SelectItem value="Salary">Staff Salary</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Input 
                      id="description" 
                      placeholder="e.g., Invoice #123 or Farmer Name"
                      value={newTransaction.description} 
                      onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})} 
                      className="col-span-3" 
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">Amount ($)</Label>
                    <Input 
                      id="amount" 
                      type="number"
                      value={newTransaction.amount} 
                      onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})} 
                      className="col-span-3" 
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status</Label>
                    <Select 
                      value={newTransaction.status} 
                      onValueChange={(value) => setNewTransaction({...newTransaction, status: value})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid / Received</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Processed">Processed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewTransactionOpen(false)} data-testid="button-cancel-transaction">Cancel</Button>
                  <Button onClick={handleAddTransaction} data-testid="button-save-transaction">Save Entry</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cane">Cane Accounting</TabsTrigger>
          <TabsTrigger value="production">Cost of Production</TabsTrigger>
          <TabsTrigger value="gst">GST & Taxation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$12.5M</div>
                <p className="text-xs text-muted-foreground text-emerald-600">+10.1% from last season</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cane Payments</CardTitle>
                <Tractor className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$8.2M</div>
                <p className="text-xs text-muted-foreground">Pending Dues: $1.2M</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Production Cost</CardTitle>
                <Factory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$2,450 / Qtl</div>
                <p className="text-xs text-muted-foreground text-rose-600">+5% due to power cost</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$1.8M</div>
                <p className="text-xs text-muted-foreground">Current Season YTD</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Sugar vs By-products Sales Performance</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="colorSugar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="sugar" stackId="1" stroke="hsl(var(--primary))" fill="url(#colorSugar)" />
                      <Area type="monotone" dataKey="molasses" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="bagasse" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest financial activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate max-w-[180px]">{tx.description}</span>
                        <span className="text-xs text-muted-foreground">{tx.category}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`font-bold text-sm ${tx.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'Income' ? '+' : '-'} ${tx.amount.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">{tx.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cane" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cane Procurement Accounting</CardTitle>
                  <CardDescription>Farmer payments, deductions, and weighbridge integration</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Scale className="mr-2 h-4 w-4" /> Sync Weighbridge
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Farmer Name</TableHead>
                    <TableHead>Cane Weight (MT)</TableHead>
                    <TableHead>Rate/MT</TableHead>
                    <TableHead>Gross Amount</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>CB-2401</TableCell>
                    <TableCell>Ramesh Patil</TableCell>
                    <TableCell>45.50</TableCell>
                    <TableCell>$3,200</TableCell>
                    <TableCell>$1,45,600</TableCell>
                    <TableCell className="text-rose-600">-$5,200</TableCell>
                    <TableCell className="font-bold">$1,40,400</TableCell>
                    <TableCell><Badge>Paid</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>CB-2402</TableCell>
                    <TableCell>Suresh Deshmukh</TableCell>
                    <TableCell>32.10</TableCell>
                    <TableCell>$3,200</TableCell>
                    <TableCell>$1,02,720</TableCell>
                    <TableCell className="text-rose-600">-$3,100</TableCell>
                    <TableCell className="font-bold">$99,620</TableCell>
                    <TableCell><Badge variant="outline">Processing</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
           <Card>
            <CardHeader>
              <CardTitle>Production Cost Sheet</CardTitle>
              <CardDescription>Cost of production per quintal breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                   <div className="flex justify-between items-center border-b pb-2">
                     <span className="font-medium">Direct Material (Cane)</span>
                     <span>$2,100.00 / Qtl</span>
                   </div>
                   <div className="flex justify-between items-center border-b pb-2">
                     <span className="font-medium">Direct Labor</span>
                     <span>$150.00 / Qtl</span>
                   </div>
                   <div className="flex justify-between items-center border-b pb-2">
                     <span className="font-medium">Chemicals & Consumables</span>
                     <span>$85.00 / Qtl</span>
                   </div>
                   <div className="flex justify-between items-center border-b pb-2">
                     <span className="font-medium">Power & Fuel</span>
                     <span>$65.00 / Qtl</span>
                   </div>
                   <div className="flex justify-between items-center border-b pb-2">
                     <span className="font-medium">Repairs & Maintenance</span>
                     <span>$50.00 / Qtl</span>
                   </div>
                   <div className="flex justify-between items-center pt-2 text-lg font-bold">
                     <span>Total Cost of Production</span>
                     <span>$2,450.00 / Qtl</span>
                   </div>
                </div>
                <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Cane", value: 2100 },
                      { name: "Labor", value: 150 },
                      { name: "Chemicals", value: 85 },
                      { name: "Power", value: 65 },
                      { name: "Maint", value: 50 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gst" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">GST Output (Sales)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$45.2 Lakhs</div>
                <p className="text-xs text-muted-foreground">Collected this month</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">GST Input (Purchases)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$28.5 Lakhs</div>
                <p className="text-xs text-muted-foreground">Eligible credit</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Net Payable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$16.7 Lakhs</div>
                <p className="text-xs text-muted-foreground">Due by 20th</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Recent GST Filings</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>ARN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date Filed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>GSTR-1</TableCell>
                    <TableCell>Feb 2024</TableCell>
                    <TableCell>AA270224123456</TableCell>
                    <TableCell><Badge>Filed</Badge></TableCell>
                    <TableCell className="text-right">11 Mar 2024</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>GSTR-3B</TableCell>
                    <TableCell>Jan 2024</TableCell>
                    <TableCell>AA270124123456</TableCell>
                    <TableCell><Badge>Filed</Badge></TableCell>
                    <TableCell className="text-right">20 Feb 2024</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Ledger (Recent Entries)</CardTitle>
              <CardDescription>All financial transactions with GST implications</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{tx.description}</span>
                          <span className="text-xs text-muted-foreground">{tx.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>{tx.category}</TableCell>
                      <TableCell>
                        <Badge variant={tx.type === "Income" ? "default" : "secondary"}>
                          {tx.type === "Income" ? "Output Tax" : "Input Tax"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${tx.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
