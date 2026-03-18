import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Trash2,
    Calendar as CalendarIcon,
    ChevronDown,
} from "lucide-react";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
    LeadData,
    LeadStatus,
    getStoredLeads,
    saveLeads,
} from "@/lib/salesSharedData";

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

function SectionHeader({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-1 bg-primary rounded-full"></div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
        </div>
    );
}

function DatePicker({ date, setDate, disabled = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const formatDisplayDate = (date: Date | undefined) => {
        if (!date) return "Pick a date";
        return format(date, "dd/MM/yyyy");
    };

    const handleDateSelect = (selectedDate: Date) => {
        setDate(selectedDate);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-[9999]" align="start">
                <div className="p-2">
                    {/* Simplified calendar for mock-up purposes, in real app would use a UI library calendar */}
                    <div className="text-center font-medium mb-2">{format(visibleDate, "MMMM yyyy")}</div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d}>{d}</div>)}
                    </div>
                    {/* Mock grid of days */}
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 30 }, (_, i) => (
                            <Button
                                key={i}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleDateSelect(new Date(visibleDate.getFullYear(), visibleDate.getMonth(), i + 1))}
                            >
                                {i + 1}
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Leads() {
    const { toast } = useToast();

    // Listing/Filtering state
    const [leads, setLeads] = useState<LeadData[]>([]);

    useEffect(() => {
        setLeads(getStoredLeads());

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "erp_mock_leads") {
                setLeads(getStoredLeads());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const updateLeads = (newLeads: LeadData[]) => {
        setLeads(newLeads);
        saveLeads(newLeads);
    };

    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingLead, setViewingLead] = useState<LeadData | null>(null);

    // Form states
    const [leadForm, setLeadForm] = useState<Partial<LeadData>>({
        customerName: "",
        contactPerson: "",
        email: "",
        phone: "",
        status: "New",
        source: "Website",
        assignedTo: "Sales Rep A",
        date: format(new Date(), "yyyy-MM-dd"),
    });

    const handleSaveLead = () => {
        if (!leadForm.customerName) {
            toast({ variant: "destructive", title: "Validation Error", description: "Customer name is required." });
            return;
        }

        const newLead: LeadData = {
            id: Date.now(),
            leadCode: `LD-${new Date().getFullYear()}-${String(leads.length + 1).padStart(3, '0')}`,
            date: leadForm.date || format(new Date(), "yyyy-MM-dd"),
            customerName: leadForm.customerName || "",
            contactPerson: leadForm.contactPerson || "",
            email: leadForm.email || "",
            phone: leadForm.phone || "",
            status: leadForm.status as LeadStatus || "New",
            source: leadForm.source || "",
            assignedTo: leadForm.assignedTo || "",
            items: [],
        };

        updateLeads([newLead, ...leads]);
        setIsFormModalOpen(false);
        setLeadForm({
            customerName: "",
            contactPerson: "",
            email: "",
            phone: "",
            status: "New",
            source: "Website",
            assignedTo: "Sales Rep A",
            date: format(new Date(), "yyyy-MM-dd"),
        });
        toast({ title: "Success", description: "Lead created successfully." });
    };

    const getStatusBadge = (status: LeadStatus) => {
        switch (status) {
            case "New": return <Badge className="bg-blue-500 hover:bg-blue-600">New</Badge>;
            case "Contacted": return <Badge className="bg-orange-500 hover:bg-orange-600">Contacted</Badge>;
            case "Qualified": return <Badge className="bg-green-500 hover:bg-green-600">Qualified</Badge>;
            case "Converted": return <Badge className="bg-purple-500 hover:bg-purple-600">Converted</Badge>;
            case "Lost": return <Badge variant="secondary">Lost</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Filtering Logic
    const filtered = leads.filter(l => {
        const matchesSearch = l.leadCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = filterDate ? l.date === format(filterDate, "yyyy-MM-dd") : true;
        const matchesStatus = filterStatus === "all" ? true : l.status === filterStatus;

        return matchesSearch && matchesDate && matchesStatus;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mt-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Leads</h2>
            </div>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-xl border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search Leads</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Code, Customer or Contact..."
                            className="pl-10 h-10 rounded-md border-input bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="w-full sm:w-56">
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filter By Date</Label>
                    <div className="flex gap-2">
                        <DatePicker date={filterDate} setDate={setFilterDate} />
                        {filterDate && (
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setFilterDate(undefined)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                </div>
                <div className="w-full sm:w-48">
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filter By Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="Contacted">Contacted</SelectItem>
                            <SelectItem value="Qualified">Qualified</SelectItem>
                            <SelectItem value="Converted">Converted</SelectItem>
                            <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => setIsFormModalOpen(true)} className="h-10 px-8 rounded-md font-bold transition-transform active:scale-95">
                    <Plus className="mr-2 h-5 w-5" />
                    New Lead
                </Button>
            </div>

            {/* Listing Table */}
            <Card className="border shadow-sm overflow-hidden bg-white/50">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4 pl-6">Lead Code</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Date</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Customer</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider">Contact</TableHead>
                                <TableHead className="font-bold uppercase text-[11px] tracking-wider text-center">Status</TableHead>
                                <TableHead className="font-bold text-[11px] tracking-wider text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.length > 0 ? paginated.map((lead) => (
                                <TableRow key={lead.id} className="hover:bg-muted/20 group transition-colors border-b last:border-none">
                                    <TableCell className="font-medium text-xs text-primary pl-6">{lead.leadCode}</TableCell>
                                    <TableCell className="text-sm">{lead.date}</TableCell>
                                    <TableCell className="text-sm">{lead.customerName}</TableCell>
                                    <TableCell className="text-sm">{lead.contactPerson}</TableCell>
                                    <TableCell className="text-center">{getStatusBadge(lead.status)}</TableCell>
                                    <TableCell className="text-center">
                                        <TableActionButtons
                                            onView={() => { setViewingLead(lead); setIsViewModalOpen(true); }}
                                        />
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                        No leads found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="flex justify-between items-center p-4 border-t">
                        <span className="text-sm text-muted-foreground">
                            Showing {Math.min(filtered.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filtered.length, currentPage * itemsPerPage)} of {filtered.length} entries
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* CREATE LEAD DIALOG */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 bg-white">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-bold">Add New Lead</DialogTitle>
                        <DialogDescription>
                            Create a new sales lead.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Customer Name *</Label>
                                <Input value={leadForm.customerName} onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })} placeholder="Company Name" className="h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Person</Label>
                                <Input value={leadForm.contactPerson} onChange={(e) => setLeadForm({ ...leadForm, contactPerson: e.target.value })} placeholder="Name" className="h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="email@example.com" className="h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="+1..." className="h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label>Source</Label>
                                <Select value={leadForm.source} onValueChange={(val) => setLeadForm({ ...leadForm, source: val })}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Website">Website</SelectItem>
                                        <SelectItem value="Referral">Referral</SelectItem>
                                        <SelectItem value="Cold Call">Cold Call</SelectItem>
                                        <SelectItem value="Advertisement">Advertisement</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={leadForm.status} onValueChange={(val) => setLeadForm({ ...leadForm, status: val as LeadStatus })}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="New">New</SelectItem>
                                        <SelectItem value="Contacted">Contacted</SelectItem>
                                        <SelectItem value="Qualified">Qualified</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto">
                        <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveLead}>Save Lead</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* VIEW LEAD DIALOG */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 bg-white">
                    {viewingLead && (
                        <>
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle className="text-xl font-bold">Lead Details</DialogTitle>
                                <DialogDescription>
                                    Viewing details for {viewingLead.leadCode}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Customer</Label>
                                        <p className="font-medium">{viewingLead.customerName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Date</Label>
                                        <p className="font-medium">{viewingLead.date}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Contact Person</Label>
                                        <p className="font-medium">{viewingLead.contactPerson}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Status</Label>
                                        <div className="pt-0.5">{getStatusBadge(viewingLead.status)}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Email</Label>
                                        <p className="font-medium">{viewingLead.email}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Phone</Label>
                                        <p className="font-medium">{viewingLead.phone}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Source</Label>
                                        <p className="font-medium">{viewingLead.source}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Assigned To</Label>
                                        <p className="font-medium">{viewingLead.assignedTo}</p>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-6 pt-2 border-t mt-auto">
                                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
