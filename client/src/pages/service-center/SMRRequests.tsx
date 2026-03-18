// ============================================================================
// MATERIAL REQUISITION COMPONENT - SERVICE CENTER MODULE
// Material Requisition listing and management
// Connected to Inventory Requisitions module via shared data store
// ============================================================================

import React, { useState } from "react";
import { format, parse } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    Plus,
    Calendar as CalendarIcon,
    Trash2,
    Check,
    ChevronsUpDown,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    X,
    CheckCircle2,
    Calendar,
    Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { DatePicker } from "@/components/shared/DatePicker";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandInputBorderless,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { mockLocations } from "@/lib/masterMockData";
// Import shared SMR data and types
import {
    type SMRStatus,
    type SMRItem,
    type SMRRequest,
    type MasterItem,
    mockWorkCenters,
    mockDepartments,
    MOCK_SMR_ITEMS,
    mockSMRRequests,
    getNextSMRNumber,
    addSMRRequest,
    updateSMRRequest,
    deleteSMRRequest
} from "@/lib/smrSharedData";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get status badge with appropriate styling
const getStatusBadge = (status: SMRStatus) => {
    switch (status) {
        case "Draft Req.":
            return <Badge className="bg-slate-500 hover:bg-slate-600">Draft Req.</Badge>;
        case "Requested Req.":
            return <Badge className="bg-blue-500 hover:bg-blue-600">Requested Req.</Badge>;
        case "Issued Req. by WH":
            return <Badge className="bg-orange-500 hover:bg-orange-600">Issued Req.</Badge>;
        case "Received Req. by SC":
            return <Badge className="bg-green-500 hover:bg-green-600">Received Req.</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

// Section header component for form sections
const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
);

// Custom date picker component
// Local DatePicker removed in favor of shared component

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SMRRequests() {
    const { toast } = useToast();

    // State management for listing - sync with shared data on mount
    const [smrRequests, setSmrRequests] = useState<SMRRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    // Default filter status: "Draft Req." - shows draft requests that can be edited/submitted
    const [filterStatus, setFilterStatus] = useState<SMRStatus | "all">("Draft Req.");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<SMRRequest | null>(null);
    const [smrToDelete, setSmrToDelete] = useState<SMRRequest | null>(null);

    // Form states for creating new SMR
    const [smrRequestDate, setSmrRequestDate] = useState<Date>(new Date());
    const [formLocation, setFormLocation] = useState<string>("");
    const [formWorkCenter, setFormWorkCenter] = useState<string>("");
    const [formDepartment, setFormDepartment] = useState<string>("");
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [addedItems, setAddedItems] = useState<SMRItem[]>([]);
    const [isItemPopoverOpen, setIsItemPopoverOpen] = useState(false);
    const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false);
    const [isWorkCenterPopoverOpen, setIsWorkCenterPopoverOpen] = useState(false);
    const [isDepartmentPopoverOpen, setIsDepartmentPopoverOpen] = useState(false);

    // Sync with shared data on component mount
    React.useEffect(() => {
        setSmrRequests([...mockSMRRequests]);
    }, []);

    // Handler for adding item to the request
    const handleAddItem = () => {
        // Validate item selection
        if (!selectedItemId) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please select an item." });
            return;
        }

        // Find the master item
        const masterItem = MOCK_SMR_ITEMS.find(i => i.id === selectedItemId);
        if (!masterItem) return;

        // Check if item already added (prevent duplicates)
        const isDuplicate = addedItems.some(item => item.itemName === masterItem.name);
        if (isDuplicate) {
            toast({ variant: "destructive", title: "Duplicate Item", description: "This item has already been added." });
            return;
        }

        // Create new SMR item with default quantity of 1
        const newItem: SMRItem = {
            id: Date.now(),
            itemName: masterItem.name,
            itemCode: masterItem.itemCode,
            uom: masterItem.uom,
            type: masterItem.type,
            availableStock: masterItem.availableStock,
            qtyNeeded: 1
        };

        setAddedItems(prev => [...prev, newItem]);
        setSelectedItemId("");
        toast({ title: "Item Added", description: `${masterItem.name} added to the request.` });
    };

    // Handler for removing item from the request
    const handleRemoveItem = (id: number | string) => {
        setAddedItems(addedItems.filter(i => i.id !== id));
    };

    // Handler for updating item quantity
    const handleUpdateItemQuantity = (id: number | string, newQty: string) => {
        // Remove non-numeric characters
        const numericValue = newQty.replace(/[^0-9]/g, '');

        // Check max length (6 digits)
        if (numericValue.length > 6) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Qty Needed cannot exceed 6 digits."
            });
            return;
        }

        // Parse the value
        const qty = numericValue === '' ? 0 : parseInt(numericValue, 10);

        // Find the item to check available stock
        const item = addedItems.find(i => i.id === id);
        if (item && qty > item.availableStock) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: `Qty Needed (${qty}) cannot exceed Available Stock (${item.availableStock}).`
            });
            // Still update the value to show the error state
            setAddedItems(prev => prev.map(item =>
                item.id === id ? { ...item, qtyNeeded: qty } : item
            ));
            return;
        }

        // Update the item
        setAddedItems(prev => prev.map(item =>
            item.id === id ? { ...item, qtyNeeded: qty } : item
        ));
    };

    // Handler for saving SMR as draft
    const handleSaveDraft = () => {
        // Validate required fields (Workcenter is optional)
        if (!formLocation || !formDepartment) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
            return;
        }

        if (addedItems.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Add at least one item." });
            return;
        }

        // Validate all items have valid quantities (must be greater than 0)
        const hasInvalidQty = addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0);
        if (hasInvalidQty) {
            toast({ variant: "destructive", title: "Validation Error", description: "All items must have Qty Needed greater than 0." });
            return;
        }

        // Validate that Qty Needed doesn't exceed Available Stock
        const itemsExceedingStock = addedItems.filter(item => item.qtyNeeded > item.availableStock);
        if (itemsExceedingStock.length > 0) {
            const itemNames = itemsExceedingStock.map(item => item.itemName).join(', ');
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: `Qty Needed cannot exceed Available Stock for: ${itemNames}`
            });
            return;
        }

        // Check if we're editing an existing request
        if (viewingRequest && viewingRequest.status === "Draft Req.") {
            // Update existing request
            const updatedData = updateSMRRequest(viewingRequest.id, {
                smrRequestDate: format(smrRequestDate, "dd-MM-yyyy"),
                location: formLocation,
                workCenter: formWorkCenter,
                department: formDepartment,
                items: addedItems
            });
            setSmrRequests(updatedData);
            resetForm();
            setIsFormModalOpen(false);
            toast({ title: "Success", description: "Material Requisition updated successfully." });
        } else {
            // Create new SMR request with Draft Req. status (default for save action)
            // Status flow: Draft Req. → Requested Req. (on submit) → Issued Req. → Received Req.
            const newRequest: SMRRequest = {
                id: Date.now(),
                smrNo: getNextSMRNumber(smrRequests),
                smrRequestDate: format(smrRequestDate, "dd-MM-yyyy"),
                location: formLocation,
                workCenter: formWorkCenter,
                department: formDepartment,
                requestedBy: "Current User", // In real app, get from auth context
                status: "Draft Req.", // Default status for saved (not submitted) requests
                items: addedItems
            };

            // Add to shared data store so it appears in Inventory module
            const updatedData = addSMRRequest(newRequest);
            setSmrRequests(updatedData);
            resetForm();
            setIsFormModalOpen(false);
            toast({ title: "Success", description: "Material Requisition saved as draft." });
        }
    };

    // Handler for submitting SMR request
    const handleSubmit = () => {
        // Validate required fields (Workcenter is optional)
        if (!formLocation || !formDepartment) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
            return;
        }

        if (addedItems.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Add at least one item." });
            return;
        }

        // Validate all items have valid quantities (must be greater than 0)
        const hasInvalidQty = addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0);
        if (hasInvalidQty) {
            toast({ variant: "destructive", title: "Validation Error", description: "All items must have Qty Needed greater than 0." });
            return;
        }

        // Validate that Qty Needed doesn't exceed Available Stock
        const itemsExceedingStock = addedItems.filter(item => item.qtyNeeded > item.availableStock);
        if (itemsExceedingStock.length > 0) {
            const itemNames = itemsExceedingStock.map(item => item.itemName).join(', ');
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: `Qty Needed cannot exceed Available Stock for: ${itemNames}`
            });
            return;
        }

        // Check if we're editing an existing request
        if (viewingRequest && viewingRequest.status === "Draft Req.") {
            // Update existing request and change status to Requested
            const updatedData = updateSMRRequest(viewingRequest.id, {
                smrRequestDate: format(smrRequestDate, "dd-MM-yyyy"),
                location: formLocation,
                workCenter: formWorkCenter,
                department: formDepartment,
                status: "Requested Req.",
                items: addedItems
            });
            setSmrRequests(updatedData);
            resetForm();
            setIsFormModalOpen(false);
            toast({ title: "Success", description: "Material Requisition updated and submitted successfully." });
        } else {
            // Create new SMR request with Requested Req. status (default for submit action)
            // This status makes the request visible in Inventory module for issuing
            // Status flow: Draft Req. → Requested Req. (on submit) → Issued Req. → Received Req.
            const newRequest: SMRRequest = {
                id: Date.now(),
                smrNo: getNextSMRNumber(smrRequests),
                smrRequestDate: format(smrRequestDate, "dd-MM-yyyy"),
                location: formLocation,
                workCenter: formWorkCenter,
                department: formDepartment,
                requestedBy: "Current User", // In real app, get from auth context
                status: "Requested Req.", // Default status for submitted requests - appears in Inventory
                items: addedItems
            };

            // Add to shared data store so it appears in Inventory module
            const updatedData = addSMRRequest(newRequest);
            setSmrRequests(updatedData);
            resetForm();
            setIsFormModalOpen(false);
            toast({ title: "Success", description: "Material Requisition submitted successfully." });
        }
    };

    // Reset form to initial state
    const resetForm = () => {
        setSmrRequestDate(new Date());
        setFormLocation("");
        setFormWorkCenter("");
        setFormDepartment("");
        setAddedItems([]);
        setSelectedItemId("");
        setViewingRequest(null); // Clear editing state
    };

    // Handler for deleting SMR request
    const handleDeleteSMR = (id: number) => {
        const updatedData = deleteSMRRequest(id);
        setSmrRequests(updatedData);
        setIsDeleteAlertOpen(false);
        setIsFormModalOpen(false);
        resetForm();
        toast({
            title: "Success",
            description: "Material Requisition deleted successfully.",
        });
    };

    // Handler for opening create modal
    const handleAddSMR = () => {
        resetForm();
        setIsFormModalOpen(true);
    };

    // Handler for viewing SMR request
    const handleView = (request: SMRRequest) => {
        setViewingRequest(request);
        setIsViewModalOpen(true);
    };

    // Handler for editing SMR request (only for Draft status)
    const handleEdit = (request: SMRRequest) => {
        // Populate form with existing request data
        setSmrRequestDate(parse(request.smrRequestDate, 'dd-MM-yyyy', new Date()));
        setFormLocation(request.location);
        setFormWorkCenter(request.workCenter);
        setFormDepartment(request.department);
        setAddedItems([...request.items]);

        // Open the form modal for editing
        setIsFormModalOpen(true);

        // Store the request being edited (we'll need to update instead of create)
        setViewingRequest(request);
    };

    /**
     * Handler for receiving SMR items
     * Changes status from "Issued SMR by WH" to "Received SMR by SC"
     * Only available in Warranty Service module for issued SMRs
     */
    const handleReceive = () => {
        if (!viewingRequest) return;

        // Validate that status is "Issued Req. by WH"
        if (viewingRequest.status !== "Issued Req. by WH") {
            toast({
                title: "Invalid Action",
                description: "Only issued SMRs can be received.",
                variant: "destructive"
            });
            return;
        }

        // Update the request status to "Received Req. by SC" using shared update function
        const updatedData = updateSMRRequest(viewingRequest.id, {
            status: "Received Req. by SC",
            receivedDate: format(new Date(), "yyyy-MM-dd"),
            receivedBy: "Service Center Manager", // In real app, get from auth context
        });

        setSmrRequests(updatedData);
        toast({
            title: "Success",
            description: `SMR ${viewingRequest.smrNo} has been received successfully.`,
        });
        setIsViewModalOpen(false);
        setViewingRequest(null);
    };

    // Filter SMR requests based on search and status filter
    const filteredRequests = smrRequests.filter(request => {
        const matchesSearch =
            request.smrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.workCenter.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === "all" ? true : request.status === filterStatus;

        let matchesDate = true;
        if (dateFilter) {
            const requestDateObj = parse(request.smrRequestDate, 'dd-MM-yyyy', new Date());
            requestDateObj.setHours(0, 0, 0, 0);
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            matchesDate = requestDateObj.getTime() === filterDate.getTime();
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const paginatedData = filteredRequests.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredRequests.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, dateFilter]);

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight">Material Requisitions</h1>

            {/* Filter Section */}
            {/* Standardized Toolbar */}
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: (val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
                    placeholder: "Search by Req No, Location, Workcenter..."
                }}
                filters={[
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter,
                        onChange: (d) => {
                            setDateFilter(d);
                            setCurrentPage(1);
                        },
                        placeholder: "Pick a date"
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: filterStatus,
                        options: [
                            { value: "all", label: "All Status" },
                            { value: "Draft Req.", label: "Draft Req." },
                            { value: "Requested Req.", label: "Requested Req." },
                            { value: "Issued Req. by WH", label: "Issued Req." },
                            { value: "Received Req. by SC", label: "Received Req." }
                        ],
                        onChange: (val) => {
                            setFilterStatus(val as SMRStatus | "all");
                            setCurrentPage(1);
                        },
                        searchable: true
                    }
                ]}
                actions={[
                    {
                        label: "Add Requisition",
                        icon: <Plus className="h-4 w-4 mr-2" />,
                        onClick: handleAddSMR
                    }
                ]}
            />

            {/* SMR Requests Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Req No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Request Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wider w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No SMR Requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((request) => (
                                        <TableRow
                                            key={request.id}
                                            className="hover:bg-muted/20 group transition-colors border-b last:border-none"
                                        >
                                            <TableCell className="py-4 font-medium font-mono">
                                                {request.smrNo}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {request.smrRequestDate}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                {request.location}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                {request.workCenter}
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getStatusBadge(request.status)}
                                            </TableCell>
                                            <TableCell className="text-center py-4">
                                                <TableActionButtons
                                                    onView={() => handleView(request)}
                                                    onEdit={request.status === "Draft Req." ? () => handleEdit(request) : undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredRequests.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        options={[10, 15, 30, 50]}
                    />
                </CardContent>
            </Card>

            {/* CREATE SMR REQUEST DIALOG */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 bg-white">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-bold">
                            {viewingRequest ? "Edit SMR Request" : "Add New SMR Request"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure the details and items for this service material request.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* General Information Section */}
                        <div>
                            <SectionHeader title="General Information" />
                            <div className="grid grid-cols-2 gap-4">
                                {/* SMR Request Date */}
                                <div className="space-y-2">
                                    <Label>SMR Request Date *</Label>
                                    <DatePicker
                                        date={smrRequestDate}
                                        setDate={(d) => d && setSmrRequestDate(d)}
                                        disabled={true}
                                    />
                                </div>

                                {/* Location */}
                                <div className="space-y-2">
                                    <Label>Location *</Label>
                                    <Popover open={isLocationPopoverOpen} onOpenChange={setIsLocationPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-full h-10 justify-between font-normal">
                                                {formLocation || "Select Location"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                            <Command>
                                                <CommandInputBorderless placeholder="Search location..." />
                                                <CommandList className="max-h-[200px] overflow-y-auto">
                                                    <CommandEmpty>No location found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {mockLocations.map((loc) => (
                                                            <CommandItem
                                                                key={loc.id}
                                                                value={loc.name}
                                                                onSelect={() => {
                                                                    setFormLocation(loc.name);
                                                                    setIsLocationPopoverOpen(false);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", formLocation === loc.name ? "opacity-100" : "opacity-0")} />
                                                                {loc.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Workcenter */}
                                <div className="space-y-2">
                                    <Label>Workcenter</Label>
                                    <Popover open={isWorkCenterPopoverOpen} onOpenChange={setIsWorkCenterPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-full h-10 justify-between font-normal">
                                                {formWorkCenter || "Select Workcenter"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                            <Command>
                                                <CommandInputBorderless placeholder="Search workcenter..." />
                                                <CommandList className="max-h-[200px] overflow-y-auto">
                                                    <CommandEmpty>No workcenter found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {mockWorkCenters.map((wc) => (
                                                            <CommandItem
                                                                key={wc}
                                                                value={wc}
                                                                onSelect={() => {
                                                                    setFormWorkCenter(wc);
                                                                    setIsWorkCenterPopoverOpen(false);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", formWorkCenter === wc ? "opacity-100" : "opacity-0")} />
                                                                {wc}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Department */}
                                <div className="space-y-2">
                                    <Label>Department *</Label>
                                    <Popover open={isDepartmentPopoverOpen} onOpenChange={setIsDepartmentPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-full h-10 justify-between font-normal">
                                                {formDepartment || "Select Department"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                            <Command>
                                                <CommandInputBorderless placeholder="Search department..." />
                                                <CommandList className="max-h-[200px] overflow-y-auto">
                                                    <CommandEmpty>No department found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {mockDepartments.map((dept) => (
                                                            <CommandItem
                                                                key={dept}
                                                                value={dept}
                                                                onSelect={() => {
                                                                    setFormDepartment(dept);
                                                                    setIsDepartmentPopoverOpen(false);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", formDepartment === dept ? "opacity-100" : "opacity-0")} />
                                                                {dept}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {/* Material Requirements Section */}
                        <div>
                            <SectionHeader title="Material Requirements" />

                            {/* Item selector with searchable dropdown */}
                            <div className="flex gap-2 items-end mb-4">
                                <div className="flex-1 space-y-2">
                                    <Label>Select Item (SFG / FG)</Label>
                                    <Popover open={isItemPopoverOpen} onOpenChange={setIsItemPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-full h-10 justify-between font-normal">
                                                {selectedItemId ? MOCK_SMR_ITEMS.find(i => i.id === selectedItemId)?.name : "Choose Item..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                            <Command>
                                                <CommandInputBorderless placeholder="Search item..." />
                                                <CommandList className="max-h-[200px] overflow-y-auto">
                                                    <CommandEmpty>No item found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {MOCK_SMR_ITEMS.map((item) => {
                                                            // Check if item already added
                                                            const isAdded = addedItems.some(ai => ai.itemName === item.name);
                                                            return (
                                                                <CommandItem
                                                                    key={item.id}
                                                                    value={item.name}
                                                                    disabled={isAdded}
                                                                    onSelect={() => {
                                                                        if (!isAdded) {
                                                                            setSelectedItemId(item.id);
                                                                            setIsItemPopoverOpen(false);
                                                                        }
                                                                    }}
                                                                    className={cn(isAdded && "opacity-50 cursor-not-allowed")}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedItemId === item.id ? "opacity-100" : "opacity-0")} />
                                                                    <span className={cn(isAdded && "text-muted-foreground")}>
                                                                        {item.name} ({item.type}) {isAdded && "(Added)"}
                                                                    </span>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Button
                                    onClick={handleAddItem}
                                    className="h-10"
                                    disabled={!selectedItemId}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                </Button>
                            </div>

                            {/* Item Table */}
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Item Name</TableHead>
                                            <TableHead className="text-center">UOM</TableHead>
                                            <TableHead className="text-center">Type (SFG / FG)</TableHead>
                                            <TableHead className="text-center">Available Stock</TableHead>
                                            <TableHead className="w-[120px] text-right">Qty Needed</TableHead>
                                            <TableHead className="w-[50px]">Remove</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {addedItems.length > 0 ? addedItems.map((item) => (
                                            <TableRow key={item.id}>
                                                {/* Item Name */}
                                                <TableCell className="font-medium text-sm">{item.itemName}</TableCell>

                                                {/* UOM */}
                                                <TableCell className="text-center text-xs">{item.uom}</TableCell>

                                                {/* Type Badge */}
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                </TableCell>

                                                {/* Available Stock */}
                                                <TableCell className="text-center font-medium">{item.availableStock}</TableCell>

                                                {/* Qty Needed Input */}
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        className={cn(
                                                            "h-8 w-20 ml-auto text-right",
                                                            (!item.qtyNeeded || item.qtyNeeded <= 0 || item.qtyNeeded > item.availableStock) && "border-destructive"
                                                        )}
                                                        value={item.qtyNeeded || ""}
                                                        onChange={(e) => handleUpdateItemQuantity(item.id, e.target.value)}
                                                        onKeyPress={(e) => {
                                                            // Allow only numbers
                                                            if (!/[0-9]/.test(e.key)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        maxLength={6}
                                                    />
                                                </TableCell>

                                                {/* Remove Button */}
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground h-20 text-sm italic">
                                                    No items added.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    {/* Form Footer with action buttons */}
                    <DialogFooter className="p-6 pt-2 border-t mt-auto flex sm:flex-row flex-col-reverse sm:justify-between justify-between items-center w-full sm:space-x-0">
                        <div className="flex justify-start">
                            {viewingRequest && viewingRequest.status === "Draft Req." && (
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        setSmrToDelete(viewingRequest);
                                        setIsDeleteAlertOpen(true);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={handleSaveDraft}
                                disabled={
                                    !formLocation ||
                                    !formDepartment ||
                                    addedItems.length === 0 ||
                                    addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0 || item.qtyNeeded > item.availableStock)
                                }
                            >
                                Save
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={
                                    !formLocation ||
                                    !formDepartment ||
                                    addedItems.length === 0 ||
                                    addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0 || item.qtyNeeded > item.availableStock)
                                }
                            >
                                Submit
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* VIEW SMR REQUEST DIALOG */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 bg-white">
                    {viewingRequest && (
                        <>
                            {/* Form header without status badge - clean UI with only title and close button */}
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle className="text-xl font-bold">
                                    SMR Request Details
                                </DialogTitle>
                                <DialogDescription>
                                    {viewingRequest.status === "Issued Req. by WH"
                                        ? "Review and receive issued materials"
                                        : "View service material request details"}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                                {/* Header Info Grid */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">SMR No</Label>
                                        <p className="font-medium">{viewingRequest.smrNo}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">SMR Request Date</Label>
                                        <p className="font-medium">{viewingRequest.smrRequestDate}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Location</Label>
                                        <p className="font-medium">{viewingRequest.location}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Workcenter</Label>
                                        <p className="font-medium">{viewingRequest.workCenter || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Department</Label>
                                        <p className="font-medium">{viewingRequest.department}</p>
                                    </div>
                                    {/* Status badge removed from form - status only shown in listing table */}

                                    {/* Show issued/received info for Issued and Received statuses */}
                                    {(viewingRequest.status === "Issued Req. by WH" || viewingRequest.status === "Received Req. by SC") && (
                                        <>
                                            {viewingRequest.issuedDate && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Issued Date</Label>
                                                    <p className="font-medium">{viewingRequest.issuedDate}</p>
                                                </div>
                                            )}
                                            {viewingRequest.issuedBy && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Issued By</Label>
                                                    <p className="font-medium">{viewingRequest.issuedBy}</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Show received info only for Received status */}
                                    {viewingRequest.status === "Received Req. by SC" && (
                                        <>
                                            {viewingRequest.receivedDate && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Received Date</Label>
                                                    <p className="font-medium">{viewingRequest.receivedDate}</p>
                                                </div>
                                            )}
                                            {viewingRequest.receivedBy && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Received By</Label>
                                                    <p className="font-medium">{viewingRequest.receivedBy}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Items Section */}
                                <div className="pt-4 border-t">
                                    <Label className="text-sm font-semibold mb-3 block">
                                        {viewingRequest.status === "Issued Req. by WH" || viewingRequest.status === "Received Req. by SC"
                                            ? "Issued Items"
                                            : "Requested Items"}
                                    </Label>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="py-2.5">Item Name</TableHead>
                                                    <TableHead className="py-2.5 text-center">UOM</TableHead>
                                                    <TableHead className="py-2.5 text-center">Type</TableHead>
                                                    {viewingRequest.status === "Draft Req." || viewingRequest.status === "Requested Req." ? (
                                                        <>
                                                            <TableHead className="py-2.5 text-center">Available Stock</TableHead>
                                                            <TableHead className="py-2.5 text-right pr-6">Qty Needed</TableHead>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TableHead className="py-2.5 text-right">Requested Qty</TableHead>
                                                            <TableHead className="py-2.5 text-right pr-6">Issued Qty</TableHead>
                                                        </>
                                                    )}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {viewingRequest.items && viewingRequest.items.length > 0 ? (
                                                    viewingRequest.items.map((item) => (
                                                        <TableRow key={item.id} className="border-b last:border-none">
                                                            <TableCell className="py-3 font-medium text-sm">{item.itemName}</TableCell>
                                                            <TableCell className="text-center text-xs">{item.uom}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                            </TableCell>
                                                            {viewingRequest.status === "Draft Req." || viewingRequest.status === "Requested Req." ? (
                                                                <>
                                                                    <TableCell className="text-center font-medium">{item.availableStock}</TableCell>
                                                                    <TableCell className="text-right font-bold text-primary pr-6">
                                                                        {item.qtyNeeded}
                                                                    </TableCell>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <TableCell className="text-right font-medium">{item.requestedQty || item.qtyNeeded}</TableCell>
                                                                    <TableCell className="text-right font-bold text-primary pr-6">
                                                                        {item.issueQty || item.qtyNeeded}
                                                                    </TableCell>
                                                                </>
                                                            )}
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-muted-foreground h-20 text-sm italic">
                                                            No items in this request.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-6 border-t mt-auto flex gap-2">
                                {/* Show Mark as Received button only for "Issued Req. by WH" status */}
                                {viewingRequest.status === "Issued Req. by WH" && (
                                    <Button
                                        onClick={handleReceive}
                                        className="bg-primary text-primary-foreground font-semibold"
                                    >
                                        Mark as Received
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto">
                                    Close
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION ALERT */}
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this SMR request? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => smrToDelete && handleDeleteSMR(smrToDelete.id)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
