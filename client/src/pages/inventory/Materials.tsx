import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, CalendarIcon, X, ChevronDown } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import { 
    type MRRequest, 
    type MRItem, 
    type MRStatus, 
    mockMRRequests, 
    updateMRRequest 
} from "@/lib/mrSharedData";
import { format } from "date-fns";
import WHReceive from "./WHReceive";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

// ============================================================================
// MOCK DATA
// ============================================================================

const WORK_CENTERS = ["Lead Furnace Center", "Plastic Casing Center", "Grid Generation Center", "Assembly Line"];
const SHIFTS = ["Morning", "Afternoon", "Night"];
const STATUS_OPTIONS = ["Requested to Warehouse", "Issued by Warehouse", "Received by Production"];

// ============================================================================
// DATE PICKER COMPONENT (Standardized)
// ============================================================================

// Local DatePicker and SearchableSelect removed in favor of shared components

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Materials() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();

    // Route matching for tabs
    const [matchMaterialRequests] = useRoute("/inventory/materials/material-requests");
    const [matchWHReceive] = useRoute("/inventory/materials/wh-receive");

    // Determine active tab based on route
    const [activeTab, setActiveTab] = useState("material-requests");

    // Redirect default route to material-requests
    useEffect(() => {
        if (location === "/inventory/materials") {
            setLocation("/inventory/materials/material-requests");
        }
        // Update active tab based on route
        if (matchMaterialRequests) {
            setActiveTab("material-requests");
        } else if (matchWHReceive) {
            setActiveTab("wh-receive");
        }
    }, [location, matchMaterialRequests, matchWHReceive, setLocation]);

    // Listing State
    const [materialRequests, setMaterialRequests] = useState<MRRequest[]>(mockMRRequests);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("Requested to Warehouse");
    const [workCenterFilter, setWorkCenterFilter] = useState("all");
    const [shiftFilter, setShiftFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modal state
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedMR, setSelectedMR] = useState<MRRequest | null>(null);


    // Filter Logic
    const filteredRequests = materialRequests.filter(mr => {
        const matchesSearch = mr.mrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mr.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || mr.status === statusFilter;
        const matchesWorkCenter = workCenterFilter === "all" || mr.workCenter === workCenterFilter;
        const matchesShift = shiftFilter === "all" || mr.shift === shiftFilter;

        let matchesDate = true;
        if (dateFilter) {
            const mrDate = new Date(mr.date);
            mrDate.setHours(0, 0, 0, 0);
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            matchesDate = mrDate.getTime() === filterDate.getTime();
        }

        return matchesSearch && matchesStatus && matchesWorkCenter && matchesShift && matchesDate;
    });

    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const paginatedRequests = filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredRequests.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, workCenterFilter, shiftFilter, dateFilter]);

    const handleOpenDetail = (mr: MRRequest) => {
        // Autofill issuedQty same as requiredQty when opening
        setSelectedMR({
            ...mr,
            items: mr.items.map(item => ({
                ...item,
                issuedQty: item.requiredQty
            }))
        });
        setIsViewModalOpen(true);
    };

    const handleIssueQtyChange = (itemId: any, value: string) => {
        if (!selectedMR) return;

        // Remove non-numeric characters except decimal point
        const numericValue = value.replace(/[^0-9.]/g, '');

        // Check if value exceeds 5 digits (before decimal point)
        const integerPart = numericValue.split('.')[0];
        if (integerPart.length > 5) {
            return; // Prevent update if exceeds max length
        }

        const qty = parseFloat(numericValue) || 0;
        setSelectedMR({
            ...selectedMR,
            items: selectedMR.items.map(item =>
                item.id === itemId ? { ...item, issuedQty: qty } : item
            )
        });
    };

    const handleIssueItems = () => {
        if (!selectedMR) return;

        const updatedRequest: MRRequest = {
            ...selectedMR,
            status: "Issued by Warehouse",
            issuedDate: new Date().toISOString(),
            issuedBy: "Warehouse Manager",
        };

        updateMRRequest(selectedMR.id, updatedRequest);
        setMaterialRequests([...mockMRRequests]);
        
        toast({
            title: "Success",
            description: `Items for ${selectedMR.mrNo} have been issued successfully.`,
        });
        setIsViewModalOpen(false);
        setSelectedMR(null);
    };

    // --------------------------------------------------------------------------
    // RENDER: LISTING VIEW
    // --------------------------------------------------------------------------

    const renderListing = () => (
        <div className="flex flex-col gap-6">
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search MR No, Requested By..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Status',
                        value: statusFilter,
                        options: [{ label: "All Status", value: "all" }, ...STATUS_OPTIONS],
                        onChange: setStatusFilter,
                        searchable: true
                    },
                    {
                        type: 'select',
                        label: 'Work Center',
                        value: workCenterFilter,
                        options: [{ label: "All Work Centers", value: "all" }, ...WORK_CENTERS],
                        onChange: setWorkCenterFilter,
                        searchable: true
                    },
                    {
                        type: 'select',
                        label: 'Shift',
                        value: shiftFilter,
                        options: [{ label: "All Shifts", value: "all" }, ...SHIFTS],
                        onChange: setShiftFilter,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter,
                        onChange: setDateFilter
                    }
                ]}
            />

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Material Requested Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Requested By</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No material requests found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRequests.map((mr) => (
                                        <TableRow key={mr.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4">{formatDate(mr.date)}</TableCell>
                                            <TableCell>{mr.requestedBy}</TableCell>
                                            <TableCell className="font-medium text-primary">{mr.mrNo}</TableCell>
                                            <TableCell>{mr.shift}</TableCell>
                                            <TableCell>{mr.workCenter}</TableCell>
                                            <TableCell>{mr.operation}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium",
                                                        mr.status === "Requested to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                                        mr.status === "Issued by Warehouse" && "border-blue-500 text-blue-600 bg-blue-50",
                                                        mr.status === "Received by Production" && "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {mr.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-3 text-xs font-medium"
                                                    onClick={() => handleOpenDetail(mr)}
                                                >
                                                    Open
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination - using standardized DataTablePagination component */}
                    {filteredRequests.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredRequests.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );

    // --------------------------------------------------------------------------
    // RENDER: DIALOG (POPUP)
    // --------------------------------------------------------------------------

    const renderDetailPopup = () => {
        if (!selectedMR) return null;

        return (
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4">
                        <div className="flex items-center justify-between pr-8">
                            <DialogTitle className="text-xl font-bold flex items-center gap-3">
                                Material Request: {selectedMR.mrNo}
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "font-medium",
                                        selectedMR.status === "Requested to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                        selectedMR.status === "Issued by Warehouse" && "border-blue-500 text-blue-600 bg-blue-50",
                                        selectedMR.status === "Received by Production" && "border-green-500 text-green-600 bg-green-50"
                                    )}
                                >
                                    {selectedMR.status}
                                </Badge>
                            </DialogTitle>
                        </div>
                        <DialogDescription>
                            View and process material requisition items.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                        <div className="md:col-span-2 space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Requested Items</h3>
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableHead className="text-[10px] uppercase font-bold py-2">Item Name</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2">Code</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2 text-right">Req Qty</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2 text-right text-primary">Avail Qty</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold py-2 text-right w-24">Issue Qty</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedMR.items.map((item) => (
                                            <TableRow key={item.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                <TableCell className="font-medium text-xs py-2">{item.itemName}</TableCell>
                                                <TableCell className="text-muted-foreground text-[10px]">{item.itemCode}</TableCell>
                                                <TableCell className="text-right text-xs">{item.requiredQty} {item.uom}</TableCell>
                                                <TableCell className="text-right text-xs font-medium text-primary">{item.availableQty} {item.uom}</TableCell>
                                                <TableCell className="text-right py-1">
                                                    {/* ✅ CHANGED: MR Request (Issued by Warehouse) - Issue Qty is read-only (cannot edit) */}
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        className="h-7 text-right text-xs font-medium px-2"
                                                        value={item.issuedQty}
                                                        onChange={(e) => handleIssueQtyChange(item.id as any, e.target.value)}
                                                        onKeyPress={(e) => {
                                                            // Allow only numbers and decimal point
                                                            if (!/[0-9.]/.test(e.key)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        onPaste={(e) => {
                                                            // Prevent paste if value exceeds 5 digits
                                                            const pastedText = e.clipboardData.getData('text');
                                                            const numericValue = pastedText.replace(/[^0-9.]/g, '');
                                                            const integerPart = numericValue.split('.')[0];
                                                            if (integerPart.length > 5) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        maxLength={7}
                                                        readOnly={selectedMR.status === "Issued by Warehouse"}
                                                        disabled={selectedMR.status === "Issued by Warehouse"}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">MR Information</h3>
                            <div className="bg-muted/20 p-4 rounded-lg border space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Requested Date:</span>
                                    <span className="font-medium text-right">{formatDate(selectedMR.date)}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Requested By:</span>
                                    <span className="font-medium text-right">{selectedMR.requestedBy}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Work Center:</span>
                                    <span className="font-medium text-right">{selectedMR.workCenter}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Operation:</span>
                                    <span className="font-medium text-right">{selectedMR.operation}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <span className="text-muted-foreground">Shift:</span>
                                    <span className="font-medium text-right">{selectedMR.shift}</span>
                                </div>

                                <div className="pt-4 mt-2 border-t">
                                    <Button
                                        className="w-full h-10 bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
                                        onClick={handleIssueItems}
                                        disabled={selectedMR.status !== 'Requested to Warehouse'}
                                    >
                                        Issue Items
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };


    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Materials</h1>
                <p className="text-muted-foreground">Manage material requests and store operations.</p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => {
                setActiveTab(value);
                if (value === "material-requests") {
                    setLocation("/inventory/materials/material-requests");
                } else if (value === "wh-receive") {
                    setLocation("/inventory/materials/wh-receive");
                }
            }} className="w-full flex-1 flex flex-col min-h-0">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                            value="material-requests"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Material Requests
                        </TabsTrigger>
                        <TabsTrigger
                            value="wh-receive"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            WH Receive
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="material-requests" className="m-0 pt-6 h-full min-h-0 overflow-auto">
                    {renderListing()}
                </TabsContent>

                <TabsContent value="wh-receive" className="m-0 pt-6 h-full min-h-0 overflow-auto">
                    <WHReceive />
                </TabsContent>
            </Tabs>

            {renderDetailPopup()}
        </div>
    );
}
