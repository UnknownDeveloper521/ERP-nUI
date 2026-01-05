import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Edit, Trash2, RefreshCw, Phone, Mail, MapPin, Calendar, User, Briefcase, AlertCircle, ArrowRight, CheckCircle2, MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";

// --- Types ---
type CRMAccount = { 
  id: number; 
  name: string; 
  type: string; 
  location: string; 
  status: string; 
  owner: string;
  industry: string;
  gst_no: string;
  email: string;
  phone: string;
};

type CRMLead = { 
  id: number; 
  name: string; 
  source: string; 
  status: string; 
  interest: string; 
  owner: string; 
  email: string; 
  phone: string;
  notes: string;
};

type CRMOpportunity = { 
  id: number; 
  title: string; 
  account: string; 
  stage: string; 
  value: number; 
  close_date: string; 
  owner: string;
  probability: number;
};

type CRMActivity = { 
  id: number; 
  type: string; 
  subject: string; 
  account: string; 
  date: string; 
  owner: string;
  description: string;
};

type CRMComplaint = { 
  id: number; 
  account: string; 
  category: string; 
  status: string; 
  date: string; 
  owner: string; 
  description: string;
};

// --- Mock Data ---
const mockAccounts: CRMAccount[] = [
  { id: 1, name: "Sweet Delights Ltd", type: "Customer", location: "Mumbai", status: "Active", owner: "John Doe", industry: "Confectionery", gst_no: "27ABCDE1234F1Z5", email: "accounts@sweetdelights.com", phone: "+91 98765 43210" },
  { id: 2, name: "Global Beverages", type: "Customer", location: "Delhi", status: "Active", owner: "Jane Smith", industry: "Beverage", gst_no: "07FGHIJ5678K1Z2", email: "procurement@globalbev.com", phone: "+91 99887 76655" },
  { id: 3, name: "Organic Foods Inc", type: "Prospect", location: "Pune", status: "Inactive", owner: "John Doe", industry: "Food Processing", gst_no: "", email: "info@organicfoods.com", phone: "+91 91234 56789" },
];

const mockLeads: CRMLead[] = [
  { id: 1, name: "Rahul Traders", source: "Trade Fair", status: "New", interest: "Bulk Sugar", owner: "John Doe", email: "rahul@example.com", phone: "9876543210", notes: "Met at AgriExpo 2025" },
  { id: 2, name: "Best Bakery Chain", source: "Website", status: "Qualified", interest: "Refined Sugar", owner: "Jane Smith", email: "contact@bestbakery.com", phone: "9988776655", notes: "Looking for monthly supply of 50MT" },
  { id: 3, name: "Green Biofuels", source: "Cold Call", status: "Contacted", interest: "Ethanol", owner: "Mike Johnson", email: "purchasing@greenbio.com", phone: "8877665544", notes: "Interested in B-Heavy molasses ethanol" },
];

const mockOpportunities: CRMOpportunity[] = [
  { id: 1, title: "500MT Supply Contract", account: "Sweet Delights Ltd", stage: "Negotiation", value: 1500000, close_date: "2025-12-15", owner: "John Doe", probability: 80 },
  { id: 2, title: "Q1 Ethanol Deal", account: "Global Beverages", stage: "Proposal", value: 500000, close_date: "2025-12-20", owner: "Jane Smith", probability: 60 },
  { id: 3, title: "Annual Maintenance", account: "Organic Foods Inc", stage: "Prospecting", value: 200000, close_date: "2026-01-10", owner: "John Doe", probability: 20 },
];

const mockActivities: CRMActivity[] = [
  { id: 1, type: "Call", subject: "Follow up on quote", account: "Sweet Delights Ltd", date: "2025-11-26", owner: "John Doe", description: "Discussed pricing for S-30 grade" },
  { id: 2, type: "Meeting", subject: "Plant Visit", account: "Organic Foods Inc", date: "2025-11-27", owner: "John Doe", description: "Client visiting to inspect quality control" },
];

const mockComplaints: CRMComplaint[] = [
  { id: 1, account: "Sweet Delights Ltd", category: "Quality", status: "Open", date: "2025-11-25", owner: "John Doe", description: "Moisture content high in last batch" },
];

export default function CRM() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("leads");
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Data State
  const [accounts, setAccounts] = useState<CRMAccount[]>(mockAccounts);
  const [leads, setLeads] = useState<CRMLead[]>(mockLeads);
  const [opportunities, setOpportunities] = useState<CRMOpportunity[]>(mockOpportunities);
  const [activities, setActivities] = useState<CRMActivity[]>(mockActivities);
  const [complaints, setComplaints] = useState<CRMComplaint[]>(mockComplaints);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentItem, setCurrentItem] = useState<any>(null);

  // Filtered Data
  const filteredLeads = leads.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.email.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAccounts = accounts.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOpportunities = opportunities.filter(o => o.title.toLowerCase().includes(searchTerm.toLowerCase()) || o.account.toLowerCase().includes(searchTerm.toLowerCase()));

  // Stats
  const stats = {
    totalLeads: leads.length,
    pipelineValue: opportunities.reduce((sum, op) => sum + op.value, 0),
    openDeals: opportunities.filter(o => o.stage !== "Closed Won" && o.stage !== "Closed Lost").length,
    activitiesDue: activities.length,
    complaintsOpen: complaints.filter(c => c.status !== "Closed").length
  };

  // Refresh Handler
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({ title: "CRM Data Updated", description: "Latest records fetched successfully." });
    }, 600);
  };

  // Generic Delete Handler
  const handleDelete = (id: number, type: string) => {
    if (type === "lead") setLeads(leads.filter(l => l.id !== id));
    if (type === "account") setAccounts(accounts.filter(a => a.id !== id));
    if (type === "opportunity") setOpportunities(opportunities.filter(o => o.id !== id));
    if (type === "activity") setActivities(activities.filter(a => a.id !== id));
    if (type === "complaint") setComplaints(complaints.filter(c => c.id !== id));
    toast({ title: "Record Deleted", variant: "destructive" });
  };

  // Convert Lead Handler
  const handleConvertLead = (lead: CRMLead) => {
    // Remove from leads
    setLeads(leads.filter(l => l.id !== lead.id));
    // Add to accounts
    const newAccount: CRMAccount = {
      id: Math.max(...accounts.map(a => a.id)) + 1,
      name: lead.name,
      type: "Customer",
      location: "Unknown", // Default
      status: "Active",
      owner: lead.owner,
      industry: "Unknown",
      gst_no: "",
      email: lead.email,
      phone: lead.phone
    };
    setAccounts([...accounts, newAccount]);
    toast({ 
      title: "Lead Converted", 
      description: `${lead.name} has been converted to a Customer Account.`,
      className: "bg-green-50 border-green-200"
    });
  };

  const handleEdit = (item: any, type: string) => {
    setCurrentItem({...item, type}); // Add type to differentiate in save handler
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setCurrentItem({ type: activeTab.slice(0, -1) }); // Remove 's' from tab name for singular type
    setModalMode("add");
    setIsModalOpen(true);
  };

  // Generic Save Handler
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    // Simulate API Delay
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsModalOpen(false);
      
      if (activeTab === "leads") {
        const newLead: CRMLead = {
          id: modalMode === 'edit' ? currentItem.id : Math.max(...leads.map(l => l.id)) + 1,
          name: formData.get("name") as string,
          email: formData.get("email") as string,
          phone: formData.get("phone") as string,
          source: formData.get("source") as string,
          interest: formData.get("interest") as string,
          status: formData.get("status") as string,
          owner: "Current User",
          notes: formData.get("notes") as string
        };
        
        if (modalMode === 'edit') {
          setLeads(leads.map(l => l.id === newLead.id ? newLead : l));
        } else {
          setLeads([...leads, newLead]);
        }
      }
      
      // Similar logic would go here for Accounts, Opportunities etc.
      // For mockup brevity, we're mostly focusing on Leads as the primary example of the pattern
      
      toast({ title: "Record Saved", description: "Data has been updated successfully." });
    }, 500);
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case "new": return "bg-blue-100 text-blue-800";
      case "qualified": return "bg-purple-100 text-purple-800";
      case "converted": return "bg-green-100 text-green-800";
      case "negotiation": return "bg-amber-100 text-amber-800";
      case "closed won": return "bg-green-100 text-green-800";
      case "open": return "bg-red-100 text-red-800";
      case "active": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Dashboard</h1>
          <p className="text-muted-foreground">Manage Leads, Customers & Sales Pipeline</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-blue-50 border-blue-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700">Total Leads</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-900">{stats.totalLeads}</div></CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">Pipeline Value</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-900">${(stats.pipelineValue / 100000).toFixed(1)}L</div></CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-700">Open Deals</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-900">{stats.openDeals}</div></CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700">Activities Due</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-900">{stats.activitiesDue}</div></CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Complaints</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-900">{stats.complaintsOpen}</div></CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" /> Add {activeTab === 'leads' ? 'Lead' : activeTab === 'accounts' ? 'Account' : 'Item'}
            </Button>
          </div>
        </div>

        {/* LEADS TAB */}
        <TabsContent value="leads">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center h-24">No leads found.</TableCell></TableRow>
                  ) : filteredLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell><Badge variant="outline" className={getStatusColor(lead.status)}>{lead.status}</Badge></TableCell>
                      <TableCell>{lead.interest}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {lead.email}</span>
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {lead.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>{lead.owner}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleConvertLead(lead)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Convert to Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(lead, 'lead')}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(lead.id, "lead")}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACCOUNTS TAB */}
        <TabsContent value="accounts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map(acc => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarFallback>{acc.name[0]}</AvatarFallback></Avatar>
                        <div>
                          <div>{acc.name}</div>
                          <div className="text-xs text-muted-foreground">{acc.location}</div>
                        </div>
                      </TableCell>
                      <TableCell>{acc.type}</TableCell>
                      <TableCell>{acc.industry}</TableCell>
                      <TableCell><Badge variant={acc.status === "Active" ? "default" : "secondary"}>{acc.status}</Badge></TableCell>
                      <TableCell>{acc.owner}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(acc, 'account')}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(acc.id, "account")}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPPORTUNITIES TAB */}
        <TabsContent value="opportunities">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value ($)</TableHead>
                    <TableHead className="text-right">Prob. (%)</TableHead>
                    <TableHead>Close Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpportunities.map(opp => (
                    <TableRow key={opp.id}>
                      <TableCell className="font-medium">{opp.title}</TableCell>
                      <TableCell>{opp.account}</TableCell>
                      <TableCell><Badge variant="outline" className={getStatusColor(opp.stage)}>{opp.stage}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{opp.value.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{opp.probability}%</TableCell>
                      <TableCell>{opp.close_date}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(opp, 'opportunity')}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(opp.id, "opportunity")}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITIES TAB */}
        <TabsContent value="activities">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map(act => (
                    <TableRow key={act.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {act.type === "Call" && <Phone className="w-4 h-4 text-blue-500"/>}
                          {act.type === "Meeting" && <Briefcase className="w-4 h-4 text-purple-500"/>}
                          {act.type}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{act.subject}</TableCell>
                      <TableCell>{act.account}</TableCell>
                      <TableCell>{act.date}</TableCell>
                      <TableCell>{act.owner}</TableCell>
                      <TableCell className="text-right">
                         <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(act.id, "activity")}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPLAINTS TAB */}
        <TabsContent value="complaints">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complaints.map(comp => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.account}</TableCell>
                      <TableCell>{comp.category}</TableCell>
                      <TableCell className="max-w-xs truncate">{comp.description}</TableCell>
                      <TableCell><Badge variant="outline" className={getStatusColor(comp.status)}>{comp.status}</Badge></TableCell>
                      <TableCell>{comp.date}</TableCell>
                      <TableCell className="text-right">
                         <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Edit className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generic Modal for Adding/Editing Items */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{modalMode === 'add' ? 'Add New' : 'Edit'} {activeTab === 'leads' ? 'Lead' : activeTab === 'accounts' ? 'Account' : activeTab === 'opportunities' ? 'Opportunity' : 'Record'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-4 py-4">
             {/* Dynamic fields based on activeTab */}
             
             {activeTab === 'leads' && (
               <>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Lead Name *</Label>
                   <Input name="name" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.name : ''} required />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Source</Label>
                   <Select name="source" defaultValue={modalMode === 'edit' ? currentItem?.source : 'Website'}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="Trade Fair">Trade Fair</SelectItem>
                        <SelectItem value="Referral">Referral</SelectItem>
                        <SelectItem value="Cold Call">Cold Call</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Interest</Label>
                   <Select name="interest" defaultValue={modalMode === 'edit' ? currentItem?.interest : 'Bulk Sugar'}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bulk Sugar">Bulk Sugar</SelectItem>
                        <SelectItem value="Refined Sugar">Refined Sugar</SelectItem>
                        <SelectItem value="Ethanol">Ethanol</SelectItem>
                        <SelectItem value="Molasses">Molasses</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Email</Label>
                   <Input name="email" type="email" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.email : ''} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Phone</Label>
                   <Input name="phone" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.phone : ''} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Notes</Label>
                   <Textarea name="notes" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.notes : ''} />
                 </div>
               </>
             )}

             {activeTab === 'accounts' && (
               <>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Account Name *</Label>
                   <Input name="name" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.name : ''} required />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Industry</Label>
                   <Select name="industry" defaultValue={modalMode === 'edit' ? currentItem?.industry : 'Food'}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Food">Food & Beverage</SelectItem>
                        <SelectItem value="Pharma">Pharma</SelectItem>
                        <SelectItem value="Industrial">Industrial</SelectItem>
                        <SelectItem value="Retail">Retail</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Location</Label>
                   <Input name="location" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.location : ''} />
                 </div>
               </>
             )}

             {activeTab === 'opportunities' && (
               <>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Opportunity Title *</Label>
                   <Input name="title" className="col-span-3" placeholder="e.g., 500MT Supply Contract" defaultValue={modalMode === 'edit' ? currentItem?.title : ''} required data-testid="input-opp-title" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Account *</Label>
                   <Select name="account" defaultValue={modalMode === 'edit' ? currentItem?.account : 'Sweet Delights Ltd'}>
                      <SelectTrigger className="col-span-3" data-testid="select-opp-account"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sweet Delights Ltd">Sweet Delights Ltd</SelectItem>
                        <SelectItem value="Global Beverages">Global Beverages</SelectItem>
                        <SelectItem value="Organic Foods Inc">Organic Foods Inc</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Stage</Label>
                   <Select name="stage" defaultValue={modalMode === 'edit' ? currentItem?.stage : 'Prospecting'}>
                      <SelectTrigger className="col-span-3" data-testid="select-opp-stage"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Prospecting">Prospecting</SelectItem>
                        <SelectItem value="Qualification">Qualification</SelectItem>
                        <SelectItem value="Proposal">Proposal</SelectItem>
                        <SelectItem value="Negotiation">Negotiation</SelectItem>
                        <SelectItem value="Closed Won">Closed Won</SelectItem>
                        <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Value ($) *</Label>
                   <Input name="value" type="number" className="col-span-3" placeholder="e.g., 1500000" defaultValue={modalMode === 'edit' ? currentItem?.value : ''} required data-testid="input-opp-value" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Close Date</Label>
                   <Input name="close_date" type="date" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.close_date : ''} data-testid="input-opp-closedate" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Probability (%)</Label>
                   <Input name="probability" type="number" min="0" max="100" className="col-span-3" placeholder="e.g., 75" defaultValue={modalMode === 'edit' ? currentItem?.probability : ''} data-testid="input-opp-probability" />
                 </div>
               </>
             )}

             {activeTab === 'activities' && (
               <>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Activity Type *</Label>
                   <Select name="type" defaultValue={modalMode === 'edit' ? currentItem?.type : 'Call'}>
                      <SelectTrigger className="col-span-3" data-testid="select-activity-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Call">Call</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Meeting">Meeting</SelectItem>
                        <SelectItem value="Site Visit">Site Visit</SelectItem>
                        <SelectItem value="Demo">Demo</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Subject *</Label>
                   <Input name="subject" className="col-span-3" placeholder="e.g., Follow up on quote" defaultValue={modalMode === 'edit' ? currentItem?.subject : ''} required data-testid="input-activity-subject" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Account</Label>
                   <Select name="account" defaultValue={modalMode === 'edit' ? currentItem?.account : 'Sweet Delights Ltd'}>
                      <SelectTrigger className="col-span-3" data-testid="select-activity-account"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sweet Delights Ltd">Sweet Delights Ltd</SelectItem>
                        <SelectItem value="Global Beverages">Global Beverages</SelectItem>
                        <SelectItem value="Organic Foods Inc">Organic Foods Inc</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Date</Label>
                   <Input name="date" type="date" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.date : ''} data-testid="input-activity-date" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Description</Label>
                   <Textarea name="description" className="col-span-3" placeholder="Add details about the activity" defaultValue={modalMode === 'edit' ? currentItem?.description : ''} data-testid="textarea-activity-desc" />
                 </div>
               </>
             )}

             {activeTab === 'complaints' && (
               <>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Account *</Label>
                   <Select name="account" defaultValue={modalMode === 'edit' ? currentItem?.account : 'Sweet Delights Ltd'}>
                      <SelectTrigger className="col-span-3" data-testid="select-complaint-account"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sweet Delights Ltd">Sweet Delights Ltd</SelectItem>
                        <SelectItem value="Global Beverages">Global Beverages</SelectItem>
                        <SelectItem value="Organic Foods Inc">Organic Foods Inc</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Category *</Label>
                   <Select name="category" defaultValue={modalMode === 'edit' ? currentItem?.category : 'Quality'}>
                      <SelectTrigger className="col-span-3" data-testid="select-complaint-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quality">Quality Issue</SelectItem>
                        <SelectItem value="Delivery">Delivery Issue</SelectItem>
                        <SelectItem value="Pricing">Pricing Dispute</SelectItem>
                        <SelectItem value="Service">Service Issue</SelectItem>
                        <SelectItem value="Documentation">Documentation Error</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Status</Label>
                   <Select name="status" defaultValue={modalMode === 'edit' ? currentItem?.status : 'Open'}>
                      <SelectTrigger className="col-span-3" data-testid="select-complaint-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Date</Label>
                   <Input name="date" type="date" className="col-span-3" defaultValue={modalMode === 'edit' ? currentItem?.date : ''} data-testid="input-complaint-date" />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right">Description *</Label>
                   <Textarea name="description" className="col-span-3" placeholder="Describe the complaint in detail" defaultValue={modalMode === 'edit' ? currentItem?.description : ''} required data-testid="textarea-complaint-desc" />
                 </div>
               </>
             )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save Record"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
