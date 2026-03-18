import { useState, useEffect } from "react";
import * as React from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    Trash2,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Download,
    ChevronsUpDown,
    Check,
    X,
} from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { DatePicker } from "@/components/shared/DatePicker";

import {
    ServiceRequestStatus,
    ServiceAction,
    WarrantyStatus,
    ClaimStatus,
    RepairItem,
    ServiceRequestData,
    MOCK_SERIAL_NUMBERS,
    REPAIR_ITEMS,
    MOCK_STOCK_DATA,
    getNextServiceRequestCode,
    getDefaultMockData
} from "@/lib/warrantyServiceSharedData";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Using shared AppListToolbar and DatePicker components

// Reusable components (using shared versions)

const formatDate = (dateStr: string) => {
    try {
        if (!dateStr) return "";
        return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
        return dateStr || "";
    }
};

const safeParseDate = (dateStr: string | undefined | null): Date | undefined => {
    if (!dateStr || dateStr === "" || dateStr === null) return undefined;
    try {
        // Handle ISO date strings (YYYY-MM-DD)
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return undefined;
        return date;
    } catch {
        return undefined;
    }
};

const safeDateString = (date: any): string => {
    try {
        if (!date) return "";
        if (typeof date === 'string') {
            const parsed = new Date(date);
            if (isNaN(parsed.getTime())) return "";
            return date;
        }
        if (date instanceof Date) {
            if (isNaN(date.getTime())) return "";
            return date.toISOString().split('T')[0];
        }
        return "";
    } catch {
        return "";
    }
};

const calculateWarrantyStatus = (warrantyEndDate: string): WarrantyStatus => {
    try {
        if (!warrantyEndDate) return "Under Warranty";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(warrantyEndDate);
        if (isNaN(endDate.getTime())) return "Under Warranty";
        endDate.setHours(0, 0, 0, 0);
        return today <= endDate ? "Under Warranty" : "Expired";
    } catch {
        return "Under Warranty";
    }
};

const getStatusBadgeVariant = (status: ServiceRequestStatus) => {
    switch (status) {
        case "Draft":
            return "outline";
        case "Submitted Request":
            return "default";
        case "Completed Request":
            return "secondary";
        case "Rejected Request":
            return "destructive";
        default:
            return "outline";
    }
};

// Helper function to get display status based on warranty status and service action
const getDisplayStatus = (request: ServiceRequestData): string => {
    if (request.status === "Completed Request") {
        // Under Warranty with Accept claim
        if (request.warrantyStatus === "Under Warranty" && request.claim === "Accept") {
            if (request.serviceAction === "Repair") {
                return "Complete Repair";
            } else if (request.serviceAction === "Replace") {
                return "Complete Replace";
            }
        }
        // Under Warranty with Reject claim (only Repair allowed, not Replace)
        else if (request.warrantyStatus === "Under Warranty" && request.claim === "Reject") {
            if (request.serviceAction === "Repair") {
                return "Complete Repair";
            }
        }
        // Expired Warranty with NA claim
        else if (request.warrantyStatus === "Expired" && request.claim === "NA") {
            if (request.serviceAction === "Repair") {
                return "Complete Repair";
            } else if (request.serviceAction === "Replace") {
                return "Complete Replace";
            } else if (!request.serviceAction || request.serviceAction === "") {
                return "Complete NA";
            }
        }
    }
    return request.status;
};


// ============================================================================
// MAIN COMPONENT
// ============================================================================

function WarrantyService() {
    const { toast } = useToast();

    // State with mock data initialization
    const [serviceRequests, setServiceRequests] = useState<ServiceRequestData[]>(() => {
        return getDefaultMockData();
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>("Draft");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewingRequest, setViewingRequest] = useState<ServiceRequestData | null>(null);

    const [formData, setFormData] = useState<Partial<ServiceRequestData>>({
        clientName: "",
        serialNumber: "",
        batch: "",
        productionDate: "",
        invoiceDate: "",
        warrantyEndDate: "",
        warrantyStatus: "Under Warranty",
        complaintDescription: "",
        claim: "",
        reason: "",
        status: "Draft",
        serviceAction: "",
        repairItems: [],
        replaceItems: [],
        labourCost: 0,
        labourBillable: false,
        serviceDate: format(new Date(), "yyyy-MM-dd") // Auto-generate today's date
    });


    // Reset form
    const resetForm = () => {
        setFormData({
            clientName: "",
            serialNumber: "",
            batch: "",
            productionDate: "",
            invoiceDate: "",
            warrantyEndDate: "",
            warrantyStatus: "Under Warranty",
            complaintDescription: "",
            claim: "",
            reason: "",
            status: "Draft",
            serviceAction: "",
            itemName: "",
            newSerialNumber: "",
            repairItems: [],
            replaceItems: [],
            labourCost: 0,
            labourBillable: false,
            serviceDate: format(new Date(), "yyyy-MM-dd") // Auto-generate today's date
        });
        setEditingId(null);
    };

    // Handle serial number input with comprehensive error handling
    const handleSerialNumberChange = (serialNumber: string) => {
        try {
            if (!serialNumber) {
                setFormData({
                    ...formData,
                    serialNumber: "",
                    batch: "",
                    productionDate: "",
                    invoiceDate: "",
                    warrantyEndDate: "",
                    warrantyStatus: "Under Warranty",
                    claim: "",
                    reason: "",
                    itemName: "",
                    clientName: "",
                    repairItems: formData.repairItems || [],
                    replaceItems: formData.replaceItems || [],
                    labourCost: formData.labourCost || 0,
                    labourBillable: formData.labourBillable || false
                });
                return;
            }

            const serialData = MOCK_SERIAL_NUMBERS.find(s => s?.serialNumber === serialNumber);
            
            if (serialData) {
                const warrantyEndDate = safeDateString(serialData.warrantyEndDate);
                const warrantyStatus = calculateWarrantyStatus(warrantyEndDate);

                setFormData({
                    ...formData,
                    itemName: serialData.itemName || "",
                    serialNumber: serialData.serialNumber || serialNumber,
                    batch: serialData.batch || "",
                    productionDate: safeDateString(serialData.productionDate),
                    invoiceDate: safeDateString(serialData.invoiceDate),
                    warrantyEndDate: warrantyEndDate,
                    warrantyStatus: warrantyStatus,
                    clientName: serialData.clientName || "",
                    claim: "",
                    reason: "",
                    repairItems: formData.repairItems || [],
                    replaceItems: formData.replaceItems || [],
                    labourCost: formData.labourCost || 0,
                    labourBillable: formData.labourBillable || false
                });
            } else {
                setFormData({
                    ...formData,
                    serialNumber: serialNumber,
                    batch: "",
                    productionDate: "",
                    invoiceDate: "",
                    warrantyEndDate: "",
                    warrantyStatus: "Under Warranty",
                    claim: "",
                    reason: "",
                    itemName: "",
                    clientName: "",
                    repairItems: formData.repairItems || [],
                    replaceItems: formData.replaceItems || [],
                    labourCost: formData.labourCost || 0,
                    labourBillable: formData.labourBillable || false
                });
            }
        } catch (e) {
            console.error('Error handling serial number change:', e);
            toast({
                title: "Error",
                description: "Failed to load serial number data",
                variant: "destructive"
            });
        }
    };

    // Handle claim change
    const handleClaimChange = (claim: ClaimStatus) => {
        // For Under Warranty + Reject, keep service action (allow repair/replace)
        // For other Reject cases, clear service action
        const shouldClearAction = claim === "Reject" && formData.warrantyStatus !== "Under Warranty";
        
        setFormData({
            ...formData,
            claim,
            reason: claim === "Reject" ? formData.reason : "",
            serviceAction: shouldClearAction ? "" : formData.serviceAction,
            repairItems: shouldClearAction ? [] : formData.repairItems,
            newSerialNumber: shouldClearAction ? "" : formData.newSerialNumber
        });
    };

    // Repair item handlers
    const handleAddRepairItem = () => {
        // Auto-check billable if warranty is expired
        const isBillable = formData.warrantyStatus === "Expired";
        
        const newItem: RepairItem = {
            id: Date.now(),
            itemName: "",
            stock: 0,
            qty: 1,
            price: 0,
            billable: isBillable
        };
        setFormData({ ...formData, repairItems: [...(formData.repairItems || []), newItem] });
    };

    const handleRemoveRepairItem = (id: number) => {
        setFormData({ ...formData, repairItems: formData.repairItems?.filter(item => item.id !== id) });
    };

    const handleRepairItemChange = (id: number, field: keyof RepairItem, value: any) => {
        const updatedItems = formData.repairItems?.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Auto-update stock number when item name changes
                if (field === "itemName" && value) {
                    updated.stock = MOCK_STOCK_DATA[value] || 0;
                }
                return updated;
            }
            return item;
        });
        setFormData({ ...formData, repairItems: updatedItems });
    };



    // No local generateServiceRequestCode needed, using getNextServiceRequestCode from shared lib


    // Save as Draft
    const handleSaveDraft = () => {
        if (!formData.clientName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.complaintDescription) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive"
            });
            return;
        }

        const requestData: ServiceRequestData = {
            id: editingId || Date.now(),
            serviceRequestCode: editingId ? formData.serviceRequestCode : getNextServiceRequestCode(serviceRequests),
            clientName: formData.clientName || "",
            serialNumber: formData.serialNumber || "",
            batch: formData.batch || "",
            productionDate: formData.productionDate || "",
            invoiceDate: formData.invoiceDate || "",
            warrantyEndDate: formData.warrantyEndDate || "",
            warrantyStatus: formData.warrantyStatus || "Under Warranty",
            complaintDescription: formData.complaintDescription || "",
            claim: formData.claim || "",
            reason: formData.reason || "",
            status: "Draft",
            serviceAction: formData.serviceAction || "",
            itemName: formData.itemName || "",
            newSerialNumber: formData.newSerialNumber || "",
            repairItems: formData.repairItems || [],
            replaceItems: formData.replaceItems || [],
            labourCost: formData.labourCost || 0,
            labourBillable: formData.labourBillable || false,
            serviceDate: formData.serviceDate || ""
        };

        if (editingId) {
            setServiceRequests(serviceRequests.map(req => req.id === editingId ? requestData : req));
            toast({ title: "Success", description: "Service request saved as draft" });
        } else {
            setServiceRequests([requestData, ...serviceRequests]);
            toast({ title: "Success", description: "Service request saved as draft" });
        }

        setIsFormModalOpen(false);
        resetForm();
    };

    // Save changes (for editing Submitted requests)
    const handleSaveChanges = () => {
        if (!formData.clientName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.complaintDescription?.trim()) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive"
            });
            return;
        }

        const requestData: ServiceRequestData = {
            id: editingId!,
            serviceRequestCode: formData.serviceRequestCode,
            clientName: formData.clientName!,
            serialNumber: formData.serialNumber!,
            batch: formData.batch!,
            productionDate: formData.productionDate!,
            invoiceDate: formData.invoiceDate!,
            warrantyEndDate: formData.warrantyEndDate!,
            warrantyStatus: formData.warrantyStatus!,
            complaintDescription: formData.complaintDescription!,
            claim: formData.claim!,
            reason: formData.reason || "",
            status: formData.status!,
            serviceAction: formData.serviceAction || "",
            itemName: formData.itemName || "",
            newSerialNumber: formData.newSerialNumber || "",
            repairItems: formData.repairItems || [],
            replaceItems: formData.replaceItems || [],
            labourCost: formData.labourCost || 0,
            labourBillable: formData.labourBillable || false,
            serviceDate: formData.serviceDate || ""
        };

        setServiceRequests(serviceRequests.map(req => req.id === editingId ? requestData : req));
        toast({ title: "Success", description: "Changes saved successfully" });
        setIsFormModalOpen(false);
        resetForm();
    };

    // Submit service request
    const handleSubmit = () => {
        if (!formData.clientName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.batch) {
            toast({
                title: "Validation Error",
                description: "Please select a valid serial number from the list",
                variant: "destructive"
            });
            return;
        }

        if (!formData.complaintDescription?.trim()) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.claim) {
            toast({
                title: "Validation Error",
                description: "Claim status is required",
                variant: "destructive"
            });
            return;
        }

        // Rejection reason is now optional
        // if (formData.claim === "Reject" && !formData.reason?.trim()) {
        //     toast({
        //         title: "Validation Error",
        //         description: "Reason is required when claim is rejected",
        //         variant: "destructive"
        //     });
        //     return;
        // }

        const status: ServiceRequestStatus = 
            formData.claim === "Accept" ? "Submitted Request" : 
            formData.claim === "NA" ? "Submitted Request" : 
            formData.claim === "Reject" && formData.warrantyStatus === "Under Warranty" ? "Submitted Request" :
            "Rejected Request";

        const requestData: ServiceRequestData = {
            id: editingId || Date.now(),
            serviceRequestCode: editingId ? formData.serviceRequestCode : getNextServiceRequestCode(serviceRequests),
            clientName: formData.clientName!,
            serialNumber: formData.serialNumber!,
            batch: formData.batch!,
            productionDate: formData.productionDate!,
            invoiceDate: formData.invoiceDate!,
            warrantyEndDate: formData.warrantyEndDate!,
            warrantyStatus: formData.warrantyStatus!,
            complaintDescription: formData.complaintDescription!,
            claim: formData.claim!,
            reason: formData.reason || "",
            status: status,
            serviceAction: formData.serviceAction || "",
            itemName: formData.itemName || "",
            newSerialNumber: formData.newSerialNumber || "",
            repairItems: formData.repairItems || [],
            replaceItems: formData.replaceItems || [],
            labourCost: formData.labourCost || 0,
            labourBillable: formData.labourBillable || false,
            serviceDate: formData.serviceDate || ""
        };

        if (editingId) {
            setServiceRequests(serviceRequests.map(req => req.id === editingId ? requestData : req));
            toast({ title: "Success", description: "Service request submitted successfully" });
        } else {
            setServiceRequests([requestData, ...serviceRequests]);
            toast({ title: "Success", description: "Service request submitted successfully" });
        }

        setIsFormModalOpen(false);
        resetForm();
    };


    // Handle edit with safe data loading
    const handleEdit = (request: ServiceRequestData) => {
        try {
            if (!request) {
                toast({
                    title: "Error",
                    description: "Invalid service request data",
                    variant: "destructive"
                });
                return;
            }

            setFormData({
                serviceRequestCode: request.serviceRequestCode || "",
                clientName: request.clientName || "",
                serialNumber: request.serialNumber || "",
                batch: request.batch || "",
                productionDate: safeDateString(request.productionDate),
                invoiceDate: safeDateString(request.invoiceDate),
                warrantyEndDate: safeDateString(request.warrantyEndDate),
                warrantyStatus: request.warrantyStatus || "Under Warranty",
                complaintDescription: request.complaintDescription || "",
                claim: request.claim || "",
                reason: request.reason || "",
                status: request.status || "Draft",
                serviceAction: request.serviceAction || "",
                itemName: request.itemName || "",
                newSerialNumber: request.newSerialNumber || "",
                repairItems: Array.isArray(request.repairItems) ? request.repairItems : [],
                replaceItems: Array.isArray(request.replaceItems) ? request.replaceItems : [],
                labourCost: typeof request.labourCost === 'number' ? request.labourCost : 0,
                labourBillable: typeof request.labourBillable === 'boolean' ? request.labourBillable : false,
                serviceDate: safeDateString(request.serviceDate) || format(new Date(), "yyyy-MM-dd") // Default to today if empty
            });
            setEditingId(request.id);
            setIsFormModalOpen(true);
        } catch (e) {
            console.error('Error loading service request for edit:', e);
            toast({
                title: "Error",
                description: "Failed to load service request data",
                variant: "destructive"
            });
        }
    };

    // Handle view with safe data loading
    const handleView = (request: ServiceRequestData) => {
        try {
            if (!request) {
                toast({
                    title: "Error",
                    description: "Invalid service request data",
                    variant: "destructive"
                });
                return;
            }

            // Create a safe copy of the request with all fields validated
            const safeRequest: ServiceRequestData = {
                id: request.id,
                serviceRequestCode: request.serviceRequestCode || "",
                clientName: request.clientName || "",
                serialNumber: request.serialNumber || "",
                itemName: request.itemName || "",
                batch: request.batch || "",
                productionDate: safeDateString(request.productionDate),
                invoiceDate: safeDateString(request.invoiceDate),
                warrantyEndDate: safeDateString(request.warrantyEndDate),
                warrantyStatus: request.warrantyStatus || "Under Warranty",
                complaintDescription: request.complaintDescription || "",
                claim: request.claim || "",
                reason: request.reason || "",
                status: request.status || "Draft",
                serviceAction: request.serviceAction || "",
                repairItems: Array.isArray(request.repairItems) ? request.repairItems : [],
                replaceItems: Array.isArray(request.replaceItems) ? request.replaceItems : [],
                newSerialNumber: request.newSerialNumber || "",
                labourCost: typeof request.labourCost === 'number' ? request.labourCost : 0,
                labourBillable: typeof request.labourBillable === 'boolean' ? request.labourBillable : false,
                serviceDate: safeDateString(request.serviceDate)
            };

            setViewingRequest(safeRequest);
            setIsViewModalOpen(true);
        } catch (e) {
            console.error('Error loading service request for view:', e);
            toast({
                title: "Error",
                description: "Failed to load service request data",
                variant: "destructive"
            });
        }
    };

    // Handle accept quotation (for Submitted Request status)
    const handleAcceptQuotation = () => {
        if (viewingRequest && viewingRequest.status === "Submitted Request") {
            setServiceRequests(serviceRequests.map(req =>
                req.id === viewingRequest.id ? { ...req, status: "Completed Request" } : req
            ));
            toast({ title: "Success", description: "Service request accepted and moved to completed" });
            
            // Auto-switch to Completed Request filter
            setFilterStatus("Completed Request");
            
            setIsViewModalOpen(false);
            setViewingRequest(null);
        }
    };

    // Export as PDF
    const handleExportPDF = (request: ServiceRequestData) => {
        // Validation before export (matching Quotations validation)
        if (!request.serviceRequestCode) {
            toast({
                title: "Validation Error",
                description: "Service request code is missing",
                variant: "destructive"
            });
            return;
        }

        if (!request.clientName) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!request.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive"
            });
            return;
        }

        if (!request.complaintDescription) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive"
            });
            return;
        }

        // Validate service action is selected for Completed Request
        if (request.status === "Completed Request" && !request.serviceAction) {
            toast({
                title: "Validation Error",
                description: "Service action is required",
                variant: "destructive"
            });
            return;
        }

        // Validate repair items if service action is Repair
        if (request.serviceAction === "Repair" && (!request.repairItems || request.repairItems.length === 0)) {
            toast({
                title: "Validation Error",
                description: "At least one repair item is required for repair action",
                variant: "destructive"
            });
            return;
        }

        // Validate new serial number if service action is Replace
        if (request.serviceAction === "Replace" && !request.newSerialNumber) {
            toast({
                title: "Validation Error",
                description: "New serial number is required for replacement action",
                variant: "destructive"
            });
            return;
        }

        // Create a properly formatted PDF-ready HTML document
        const pdfContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Service Request ${request.serviceRequestCode}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        padding: 20px;
                        color: #333;
                        line-height: 1.4;
                        background: white;
                        font-size: 11px;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 20px;
                        padding-bottom: 12px;
                        border-bottom: 3px solid #2563eb;
                        page-break-after: avoid;
                    }
                    
                    .company-info h1 {
                        color: #2563eb;
                        font-size: 22px;
                        font-weight: bold;
                        margin-bottom: 3px;
                    }
                    
                    .company-info p {
                        color: #666;
                        font-size: 10px;
                        line-height: 1.3;
                    }
                    
                    .document-title {
                        text-align: right;
                    }
                    
                    .document-title h2 {
                        font-size: 20px;
                        color: #1e293b;
                        margin-bottom: 3px;
                    }
                    
                    .document-title p {
                        color: #666;
                        font-size: 11px;
                    }
                    
                    .section {
                        margin-bottom: 16px;
                        page-break-inside: avoid;
                    }
                    
                    .section-title {
                        font-weight: 600;
                        font-size: 10px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 8px;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #e2e8f0;
                        page-break-after: avoid;
                    }
                    
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px 20px;
                    }
                    
                    .info-item {
                        margin-bottom: 0;
                    }
                    
                    .info-label {
                        font-size: 9px;
                        color: #64748b;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                        margin-bottom: 2px;
                    }
                    
                    .info-value {
                        font-size: 11px;
                        color: #1e293b;
                        font-weight: 500;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 10px 0;
                        font-size: 10px;
                        page-break-inside: avoid;
                    }
                    
                    thead {
                        background-color: #f8fafc;
                        page-break-after: avoid;
                    }
                    
                    th {
                        padding: 8px 10px;
                        text-align: left;
                        font-weight: 600;
                        font-size: 9px;
                        color: #475569;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    
                    th.text-right {
                        text-align: right;
                    }
                    
                    td {
                        padding: 7px 10px;
                        border-bottom: 1px solid #f1f5f9;
                        color: #334155;
                        font-size: 10px;
                    }
                    
                    td.text-right {
                        text-align: right;
                    }
                    
                    td.text-center {
                        text-align: center;
                    }
                    
                    .totals-section {
                        margin-top: 12px;
                        display: flex;
                        justify-content: flex-end;
                    }
                    
                    .totals-box {
                        width: 280px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    
                    .totals-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 12px;
                        border-bottom: 1px solid #f1f5f9;
                        font-size: 10px;
                    }
                    
                    .totals-row:last-child {
                        border-bottom: none;
                    }
                    
                    .totals-row.total {
                        background-color: #2563eb;
                        color: white;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    
                    .totals-label {
                        color: #64748b;
                    }
                    
                    .totals-row.total .totals-label {
                        color: white;
                    }
                    
                    .totals-value {
                        font-weight: 600;
                        color: #1e293b;
                    }
                    
                    .totals-row.total .totals-value {
                        color: white;
                    }
                    
                    .signatures {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 30px;
                        margin-top: 20px;
                        padding-top: 15px;
                        page-break-inside: avoid;
                    }
                    
                    .signature-box {
                        text-align: center;
                    }
                    
                    .signature-line {
                        border-top: 2px solid #cbd5e1;
                        margin-top: 30px;
                        padding-top: 8px;
                        font-size: 10px;
                        color: #64748b;
                        font-weight: 500;
                    }
                    
                    .footer {
                        margin-top: 15px;
                        padding-top: 10px;
                        border-top: 1px solid #e2e8f0;
                        text-align: center;
                        font-size: 9px;
                        color: #94a3b8;
                        line-height: 1.4;
                        page-break-inside: avoid;
                    }
                    
                    .status-badge {
                        display: inline-block;
                        padding: 3px 10px;
                        border-radius: 10px;
                        font-size: 9px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                    }
                    
                    .status-under-warranty {
                        background-color: #dcfce7;
                        color: #166534;
                    }
                    
                    .status-expired {
                        background-color: #fee2e2;
                        color: #991b1b;
                    }
                    
                    .claim-accept {
                        background-color: #dbeafe;
                        color: #1e40af;
                    }
                    
                    .claim-reject {
                        background-color: #fee2e2;
                        color: #991b1b;
                    }
                    
                    @media print {
                        body {
                            padding: 0;
                        }
                        
                        .no-print {
                            display: none;
                        }
                        
                        @page {
                            margin: 15mm;
                            size: A4 portrait;
                        }
                        
                        * {
                            page-break-inside: avoid;
                        }
                        
                        .section {
                            page-break-inside: avoid;
                        }
                        
                        table {
                            page-break-inside: avoid;
                        }
                        
                        .signatures {
                            page-break-before: avoid;
                        }
                        
                        .footer {
                            page-break-before: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <!-- Header -->
                <div class="header">
                    <div class="company-info">
                        <h1>MASTER-ERP</h1>
                        <p>Industrial Solutions & Services<br>
                        Ahmedabad, Gujarat, India</p>
                    </div>
                    <div class="document-title">
                        <h2>WARRANTY SERVICE REQUEST</h2>
                        <p># ${request.serviceRequestCode || 'DRAFT'}</p>
                    </div>
                </div>

                <!-- Service Request Details -->
                <div class="section">
                    <div class="section-title">Service Request Details</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Service Request Code</div>
                            <div class="info-value">${request.serviceRequestCode || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Consumer Name</div>
                            <div class="info-value">${request.clientName || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Serial Number</div>
                            <div class="info-value">${request.serialNumber || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Item Name</div>
                            <div class="info-value">${request.itemName || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Batch</div>
                            <div class="info-value">${request.batch || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Production Date</div>
                            <div class="info-value">${formatDate(request.productionDate)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Invoice Date</div>
                            <div class="info-value">${formatDate(request.invoiceDate)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Warranty End Date</div>
                            <div class="info-value">${formatDate(request.warrantyEndDate)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Warranty Status</div>
                            <div class="info-value">
                                <span class="status-badge status-${request.warrantyStatus === "Under Warranty" ? "under-warranty" : "expired"}">${request.warrantyStatus}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Claim Status</div>
                            <div class="info-value">
                                <span class="status-badge claim-${request.claim?.toLowerCase() || 'accept'}">${request.claim || '—'}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">${request.status}</div>
                        </div>
                    </div>
                </div>

                <!-- Complaint Description -->
                <div class="section">
                    <div class="section-title">Complaint Description</div>
                    <p style="color: #475569; font-size: 10px; line-height: 1.5;">${request.complaintDescription || '—'}</p>
                </div>

                ${request.reason ? `
                <!-- Rejection Reason -->
                <div class="section">
                    <div class="section-title">Rejection Reason</div>
                    <p style="color: #475569; font-size: 10px; line-height: 1.5;">${request.reason}</p>
                </div>
                ` : ''}

                ${request.serviceAction ? `
                <!-- Service Action -->
                <div class="section">
                    <div class="section-title">Service Action</div>
                    <div class="info-item">
                        <div class="info-label">Action Type</div>
                        <div class="info-value">${request.serviceAction}</div>
                    </div>
                </div>
                ` : ''}

                ${request.serviceAction === "Repair" && request.repairItems && request.repairItems.length > 0 ? `
                <!-- Repair Items -->
                <div class="section">
                    <div class="section-title">Repair Items</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 10%;">#</th>
                                <th style="width: 10%;" class="text-center">Billable</th>
                                <th style="width: 35%;">Item Name</th>
                                <th style="width: 15%;" class="text-center">Stock</th>
                                <th style="width: 10%;" class="text-center">Qty</th>
                                <th style="width: 20%;" class="text-right">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${request.repairItems.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td class="text-center">${item.billable ? '✓' : '—'}</td>
                                    <td><strong>${item.itemName}</strong></td>
                                    <td class="text-center">${item.stock}</td>
                                    <td class="text-center">${item.qty}</td>
                                    <td class="text-right">$${item.price.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- Labour Cost and Total -->
                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="totals-row">
                                <span class="totals-label">Labour Cost ${request.labourBillable ? '(Billable)' : ''}</span>
                                <span class="totals-value">$${(request.labourCost || 0).toFixed(2)}</span>
                            </div>
                            <div class="totals-row total">
                                <span class="totals-label">Total Price</span>
                                <span class="totals-value">$${((request.repairItems || []).reduce((sum, item) => sum + (item.billable ? item.price * item.qty : 0), 0) + (request.labourBillable ? (request.labourCost || 0) : 0)).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${request.serviceAction === "Replace" && request.newSerialNumber ? `
                <!-- Replacement Details -->
                <div class="section">
                    <div class="section-title">Replacement Details</div>
                    <div class="info-item">
                        <div class="info-label">New Serial Number</div>
                        <div class="info-value">${request.newSerialNumber}</div>
                    </div>
                </div>
                ` : ''}

                <!-- Signatures -->
                <div class="signatures">
                    <div class="signature-box">
                        <div class="signature-line">Service Technician</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line">Authorized Signatory</div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer">
                    <p>This is a computer-generated service request. Generated on ${format(new Date(), "dd-MM-yyyy, HH:mm")}.</p>
                    <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                </div>
            </body>
            </html>
        `;

        // Create a hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(pdfContent);
            iframeDoc.close();

            // Wait for images and resources to load
            const printIframe = () => {
                const win = iframe.contentWindow;
                if (win) {
                    win.focus();
                    win.print();
                    // Clean up after printing
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }
            };

            if (iframe.contentWindow) {
                // Some browsers need a small delay
                setTimeout(printIframe, 500);
            }
        } else {
            toast({
                title: "Error",
                description: "Could not initialize printing",
                variant: "destructive"
            });
            document.body.removeChild(iframe);
        }

        toast({
            title: "Printing",
            description: "Preparing service request for print..."
        });
    };

    // Handle fulfill
    const handleFulfill = () => {
        if (editingId && formData.status === "Submitted Request") {
            // Validate from form modal
            // Service action is optional for NA claim (expired warranty)
            if (!formData.serviceAction && formData.claim !== "NA") {
                toast({
                    title: "Validation Error",
                    description: "Service action is required to fulfill the request",
                    variant: "destructive"
                });
                return;
            }

            if (formData.serviceAction === "Repair" && (!formData.repairItems || formData.repairItems.length === 0)) {
                toast({
                    title: "Validation Error",
                    description: "At least one repair item is required for repair action",
                    variant: "destructive"
                });
                return;
            }

            if (formData.serviceAction === "Replace" && !formData.newSerialNumber) {
                toast({
                    title: "Validation Error",
                    description: "New Serial Number is required for replacement action",
                    variant: "destructive"
                });
                return;
            }

            // Update the request
            const updatedRequest: ServiceRequestData = {
                id: editingId,
                serviceRequestCode: formData.serviceRequestCode,
                clientName: formData.clientName!,
                serialNumber: formData.serialNumber!,
                batch: formData.batch!,
                productionDate: formData.productionDate!,
                invoiceDate: formData.invoiceDate!,
                warrantyEndDate: formData.warrantyEndDate!,
                warrantyStatus: formData.warrantyStatus!,
                complaintDescription: formData.complaintDescription!,
                claim: formData.claim!,
                reason: formData.reason || "",
                status: "Completed Request",
                serviceAction: formData.serviceAction || "",
                itemName: formData.itemName || "",
                newSerialNumber: formData.newSerialNumber || "",
                repairItems: formData.repairItems || [],
                replaceItems: formData.replaceItems || [],
                labourCost: formData.labourCost || 0,
                labourBillable: formData.labourBillable || false,
                serviceDate: formData.serviceDate || ""
            };

            setServiceRequests(serviceRequests.map(req => req.id === editingId ? updatedRequest : req));
            toast({ title: "Success", description: "Service request completed successfully" });

            // Auto-switch to Completed Request filter
            setFilterStatus("Completed Request");

            setIsFormModalOpen(false);
            resetForm();
        } else if (viewingRequest) {
            // Validate from view modal
            // Service action is optional for NA claim (expired warranty)
            if (!viewingRequest.serviceAction && viewingRequest.claim !== "NA") {
                toast({
                    title: "Validation Error",
                    description: "Service action is required to fulfill the request",
                    variant: "destructive"
                });
                return;
            }

            if (viewingRequest.serviceAction === "Repair" && (!viewingRequest.repairItems || viewingRequest.repairItems.length === 0)) {
                toast({
                    title: "Validation Error",
                    description: "At least one repair item is required for repair action",
                    variant: "destructive"
                });
                return;
            }

            if (viewingRequest.serviceAction === "Replace" && !viewingRequest.newSerialNumber) {
                toast({
                    title: "Validation Error",
                    description: "New Serial Number is required for replacement action",
                    variant: "destructive"
                });
                return;
            }

            setServiceRequests(serviceRequests.map(sr =>
                sr.id === viewingRequest.id ? { ...sr, status: "Completed Request" } : sr
            ));
            toast({ title: "Success", description: "Service request completed successfully" });

            // Auto-switch to Completed Request filter
            setFilterStatus("Completed Request");

            setIsViewModalOpen(false);
            setViewingRequest(null);
        }
    };

    // Update service action in view modal
    const handleServiceActionUpdate = (action: ServiceAction) => {
        if (viewingRequest) {
            // Auto-check labour billable if warranty is expired and action is Repair
            const labourBillable = action === "Repair" && viewingRequest.warrantyStatus === "Expired";
            const updatedRequest = { ...viewingRequest, serviceAction: action, labourBillable };
            setViewingRequest(updatedRequest);
            setServiceRequests(serviceRequests.map(req => req.id === viewingRequest.id ? updatedRequest : req));
        }
    };

    // Update repair/replace items in view modal
    const updateViewingRequest = (updates: Partial<ServiceRequestData>) => {
        if (viewingRequest) {
            const updatedRequest = { ...viewingRequest, ...updates };
            setViewingRequest(updatedRequest);
            setServiceRequests(serviceRequests.map(req => req.id === viewingRequest.id ? updatedRequest : req));
        }
    };

    // Filtering and pagination with error handling
    const filteredData = React.useMemo(() => {
        try {
            if (!Array.isArray(serviceRequests)) return [];
            
            return serviceRequests.filter((item) => {
                try {
                    const matchesSearch =
                        (item.serviceRequestCode?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                        (item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
                    const matchesStatus = filterStatus === "All" || item.status === filterStatus;
                    
                    // Robust date matching
                    let matchesDate = true;
                    if (filterDate) {
                        try {
                            const selectedDateStr = format(filterDate, "yyyy-MM-dd");
                            // Normalize item date - handle cases where it might be a Date object or string
                            const itemDate = safeParseDate(item.serviceDate);
                            const itemDateStr = itemDate ? format(itemDate, "yyyy-MM-dd") : "";
                            matchesDate = itemDateStr === selectedDateStr;
                        } catch (e) {
                            console.error('Error matching date:', e);
                            matchesDate = false;
                        }
                    }

                    return matchesSearch && matchesStatus && matchesDate;
                } catch (e) {
                    console.error('Error filtering item:', e);
                    return false;
                }
            });
        } catch (e) {
            console.error('Error filtering data:', e);
            return [];
        }
    }, [serviceRequests, searchTerm, filterStatus, filterDate]);

    const paginatedData = React.useMemo(() => {
        try {
            if (!Array.isArray(filteredData)) return [];
            return filteredData.slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage
            );
        } catch (e) {
            console.error('Error paginating data:', e);
            return [];
        }
    }, [filteredData, currentPage, itemsPerPage]);

    const totalPages = Math.max(1, Math.ceil((filteredData?.length || 0) / itemsPerPage));

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterDate]);


    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Warranty Service Request</h1>

            {/* Filters */}
            {/* Standardized Toolbar */}
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by Code, Serial No..."
                }}
                filters={[
                    {
                        type: 'date',
                        label: 'Date',
                        value: filterDate,
                        onChange: setFilterDate,
                        placeholder: "All Dates"
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: filterStatus,
                        options: [
                            { value: "All", label: "All Status" },
                            { value: "Draft", label: "Draft" },
                            { value: "Submitted Request", label: "Submitted Request" },
                            { value: "Completed Request", label: "Completed Request" },
                            { value: "Rejected Request", label: "Rejected Request" }
                        ],
                        onChange: setFilterStatus,
                        searchable: true
                    }
                ]}
                actions={[
                    {
                        label: "New Service Request",
                        icon: <Plus className="mr-2 h-4 w-4" />,
                        onClick: () => { resetForm(); setIsFormModalOpen(true); }
                    }
                ]}
            />

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Service Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Consumer Name</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Serial Number</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Service Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warranty Status</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Claim</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wider w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No service requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((item) => {
                                        try {
                                            if (!item || typeof item !== 'object') {
                                                console.warn('Invalid item in paginatedData:', item);
                                                return null;
                                            }
                                            
                                            return (
                                                <TableRow key={item?.id || Math.random()} className="hover:bg-muted/30 transition-colors border-b">
                                                    <TableCell className="py-4 font-medium font-mono">
                                                        {item?.serviceRequestCode || "—"}
                                                    </TableCell>
                                                    <TableCell>{item?.clientName || "—"}</TableCell>
                                                    <TableCell className="font-mono">{item?.serialNumber || "—"}</TableCell>
                                                    <TableCell>{item?.serviceDate ? formatDate(item.serviceDate) : "—"}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={item?.warrantyStatus === "Under Warranty" ? "default" : "outline"}
                                                            className={cn(
                                                                item?.warrantyStatus === "Under Warranty" && "bg-green-500 hover:bg-green-600 border-green-500"
                                                            )}
                                                        >
                                                            {item?.warrantyStatus || "Under Warranty"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item?.claim ? (
                                                            <Badge variant={item.claim === "Accept" ? "default" : "destructive"}>
                                                                {item.claim}
                                                            </Badge>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusBadgeVariant(item?.status || "Draft")}>
                                                            {getDisplayStatus(item)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center py-4">
                                                        <TableActionButtons
                                                            onView={() => handleView(item)}
                                                            onEdit={(item?.status === "Draft" || item?.status === "Submitted Request") ? () => handleEdit(item) : undefined}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        } catch (e) {
                                            console.error('Error rendering table row:', e, item);
                                            return null;
                                        }
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredData.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredData.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>


            {/* Create/Edit Form Modal */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">
                            {editingId ? "Edit Service Request" : "New Service Request"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Service Date - At the top */}
                        <div className="space-y-2">
                            <Label>Service Date</Label>
                            <Input
                                value={formData.serviceDate ? formatDate(formData.serviceDate) : ""}
                                disabled
                                className="bg-slate-50"
                            />
                        </div>

                        {/* Serial Number */}
                        <div className="space-y-2">
                            <Label>
                                Serial Number <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter serial number"
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    className="flex-1"
                                    disabled={!!editingId && formData.status !== "Draft"}
                                />
                                {(!editingId || formData.status === "Draft") && (
                                    <Button
                                        className="h-10 shrink-0 bg-blue-600 hover:bg-blue-700"
                                        onClick={() => {
                                            if (formData.serialNumber) {
                                                handleSerialNumberChange(formData.serialNumber);
                                            }
                                        }}
                                    >
                                        <Search className="h-4 w-4 mr-2" />
                                        Search
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Item details box - Always show */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Item Name</Label>
                                <p className="font-semibold">{formData.itemName || "—"}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Consumer Name</Label>
                                <Input 
                                    value={formData.clientName || ""} 
                                    disabled 
                                    className="bg-white font-semibold" 
                                    placeholder="—"
                                />
                            </div>
                            {formData.serialNumber && formData.batch && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Batch</Label>
                                        <p className="font-semibold">{formData.batch || "—"}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Production Date</Label>
                                        <p className="font-semibold">{formatDate(formData.productionDate || "") || "—"}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                                        <DatePicker
                                            date={safeParseDate(formData.invoiceDate)}
                                            setDate={(date) => {
                                                try {
                                                    setFormData({ ...formData, invoiceDate: date ? format(date, "yyyy-MM-dd") : "" });
                                                } catch (e) {
                                                    console.error('Error setting invoice date:', e);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Warranty End Date</Label>
                                        <DatePicker
                                            date={safeParseDate(formData.warrantyEndDate)}
                                            setDate={(date) => {
                                                try {
                                                    if (date) {
                                                        const newWarrantyEndDate = format(date, "yyyy-MM-dd");
                                                        const newWarrantyStatus = calculateWarrantyStatus(newWarrantyEndDate);
                                                        setFormData({
                                                            ...formData,
                                                            warrantyEndDate: newWarrantyEndDate,
                                                            warrantyStatus: newWarrantyStatus
                                                        });
                                                    } else {
                                                        setFormData({ ...formData, warrantyEndDate: "" });
                                                    }
                                                } catch (e) {
                                                    console.error('Error setting warranty end date:', e);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Warranty Status</Label>
                                        <div className="flex items-center h-10">
                                            <Badge
                                                variant={formData.warrantyStatus === "Under Warranty" ? "default" : "outline"}
                                                className={cn(
                                                    "text-sm",
                                                    formData.warrantyStatus === "Under Warranty" && "bg-green-500 hover:bg-green-600 border-green-500"
                                                )}
                                            >
                                                {formData.warrantyStatus || "Under Warranty"}
                                            </Badge>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Complaint Description */}
                        <div className="space-y-2">
                            <Label>
                                Complaint Description <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                placeholder="Describe the complaint in detail..."
                                value={formData.complaintDescription}
                                onChange={(e) => setFormData({ ...formData, complaintDescription: e.target.value })}
                                rows={3}
                            />
                        </div>

                        {/* Claim */}
                        <div className="space-y-2">
                            <Label>
                                Claim <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={formData.claim}
                                onValueChange={(value) => handleClaimChange(value as ClaimStatus)}
                            >
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select claim status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {formData.warrantyStatus === "Expired" ? (
                                        <SelectItem value="NA">NA</SelectItem>
                                    ) : (
                                        <>
                                            <SelectItem value="Accept">Accept</SelectItem>
                                            <SelectItem value="Reject">Reject</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Rejection Remarks (optional if Reject) */}
                        {formData.claim === "Reject" && (
                            <div className="space-y-2">
                                <Label>
                                    Rejection Remarks
                                </Label>
                                <Textarea
                                    placeholder="Enter reason for rejection..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    rows={2}
                                />
                            </div>
                        )}

                        {/* Service Action Section - For Submitted status when editing (both Accept and Reject) */}
                        {editingId && formData.status === "Submitted Request" && (
                            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
                                    Service Action
                                </h3>

                                <div className="space-y-2">
                                    <Label>Select Action</Label>
                                    <Select
                                        value={formData.serviceAction}
                                        onValueChange={(value) => {
                                            const action = value as ServiceAction;
                                            // Auto-check labour billable if warranty is expired and action is Repair
                                            const labourBillable = action === "Repair" && formData.warrantyStatus === "Expired";
                                            setFormData({ ...formData, serviceAction: action, labourBillable });
                                        }}
                                    >
                                        <SelectTrigger className="h-10 bg-white">
                                            <SelectValue placeholder="Select service action" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Repair">Repair</SelectItem>
                                            {/* Replace option only for Accept claim or NA claim, not for Reject */}
                                            {formData.claim !== "Reject" && (
                                                <SelectItem value="Replace">Replace</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Repair Section */}
                                {formData.serviceAction === "Repair" && (
                                    <div className="space-y-3 mt-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-semibold">Repair Item Parts</Label>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleAddRepairItem}
                                                className="h-8"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add Item
                                            </Button>
                                        </div>

                                        <div className="max-h-[300px] overflow-y-auto border rounded-lg bg-white">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50">
                                                        <TableHead className="w-[80px]">Billable</TableHead>
                                                        <TableHead className="w-[50px]">#</TableHead>
                                                        <TableHead>Item Name</TableHead>
                                                        <TableHead className="w-[100px]">Stock</TableHead>
                                                        <TableHead className="w-[100px]">Qty</TableHead>
                                                        <TableHead className="w-[120px]">Price</TableHead>
                                                        <TableHead className="w-[60px]"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(!formData.repairItems || formData.repairItems.length === 0) ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                                                                No repair items added
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        formData.repairItems.map((item, index) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="text-center">
                                                                    <Checkbox
                                                                        checked={item.billable}
                                                                        onCheckedChange={(checked) => handleRepairItemChange(item.id, "billable", checked)}
                                                                        className="h-5 w-5"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>{index + 1}</TableCell>
                                                                <TableCell>
                                                                    <Select
                                                                        value={item.itemName}
                                                                        onValueChange={(value) => handleRepairItemChange(item.id, "itemName", value)}
                                                                    >
                                                                        <SelectTrigger className="h-9">
                                                                            <SelectValue placeholder="Select item" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {REPAIR_ITEMS.map((repairItem) => (
                                                                                <SelectItem key={repairItem} value={repairItem}>
                                                                                    {repairItem}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        value={item.stock}
                                                                        disabled
                                                                        className="h-9 bg-slate-50"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        value={item.qty}
                                                                        onChange={(e) => handleRepairItemChange(item.id, "qty", parseInt(e.target.value) || 0)}
                                                                        className="h-9"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        placeholder="Price"
                                                                        value={item.price}
                                                                        onChange={(e) => handleRepairItemChange(item.id, "price", parseFloat(e.target.value) || 0)}
                                                                        className="h-9"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleRemoveRepairItem(item.id)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                            
                                            {/* Labour Cost Row */}
                                            <div className="border-t p-4 space-y-3 bg-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox
                                                            checked={formData.labourBillable || false}
                                                            onCheckedChange={(checked) => setFormData({ ...formData, labourBillable: !!checked })}
                                                            className="h-5 w-5"
                                                        />
                                                        <Label className="font-semibold">Labour Cost</Label>
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Amount"
                                                        value={formData.labourCost || 0}
                                                        onChange={(e) => setFormData({ ...formData, labourCost: parseFloat(e.target.value) || 0 })}
                                                        className="h-9 w-32"
                                                    />
                                                </div>
                                                
                                                {/* Total Price */}
                                                <div className="flex items-center justify-between pt-2 border-t">
                                                    <Label className="font-bold text-lg">Total Price</Label>
                                                    <span className="font-bold text-lg text-primary">
                                                        ${((formData.repairItems || []).reduce((sum, item) => sum + (item.billable ? item.price * item.qty : 0), 0) + (formData.labourBillable ? (formData.labourCost || 0) : 0)).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Replace Section */}
                                {formData.serviceAction === "Replace" && (
                                    <div className="space-y-3 mt-4">
                                        <Label className="text-sm font-semibold">New Serial Number</Label>
                                        <Input
                                            placeholder="Enter new serial number (FG remains same)"
                                            value={formData.newSerialNumber || ""}
                                            onChange={(e) => setFormData({ ...formData, newSerialNumber: e.target.value })}
                                            className="h-10 border-blue-200 focus:border-blue-400"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setIsFormModalOpen(false); resetForm(); }}>
                            Close
                        </Button>
                        {editingId && formData.status === "Submitted Request" ? (
                            <Button onClick={handleFulfill}>
                                Complete
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={handleSaveDraft}>
                                    Save
                                </Button>
                                <Button onClick={handleSubmit}>
                                    Submit
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* View Modal */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">
                            Service Request Details
                        </DialogTitle>
                    </DialogHeader>

                    {viewingRequest && (
                        <div className="space-y-6">
                            {/* Request Information */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Service Code</Label>
                                    <p className="font-mono font-semibold">{viewingRequest.serviceRequestCode || "—"}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Consumer Name</Label>
                                    <p className="font-semibold">{viewingRequest.clientName}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Service Date</Label>
                                    <p className="font-medium">{viewingRequest.serviceDate ? formatDate(viewingRequest.serviceDate) : "—"}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Status</Label>
                                    <div className="mt-1">
                                        <Badge variant={getStatusBadgeVariant(viewingRequest.status)}>
                                            {getDisplayStatus(viewingRequest)}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Claim</Label>
                                    <div className="mt-1">
                                        {viewingRequest.claim ? (
                                            <Badge variant={viewingRequest.claim === "Accept" ? "default" : "destructive"}>
                                                {viewingRequest.claim}
                                            </Badge>
                                        ) : (
                                            "—"
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Serial Number & Warranty Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b pb-2">
                                    Warranty Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Serial Number</Label>
                                        <p className="font-mono font-medium">{viewingRequest.serialNumber}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Batch</Label>
                                        <p className="font-medium">{viewingRequest.batch}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Production Date</Label>
                                        <p className="font-medium">{formatDate(viewingRequest.productionDate)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                                        <p className="font-medium">{formatDate(viewingRequest.invoiceDate)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Warranty End Date</Label>
                                        <p className="font-medium">{formatDate(viewingRequest.warrantyEndDate)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Warranty Status</Label>
                                        <div className="mt-1">
                                            <Badge
                                                variant={viewingRequest.warrantyStatus === "Under Warranty" ? "default" : "outline"}
                                                className={cn(
                                                    viewingRequest.warrantyStatus === "Under Warranty" && "bg-green-500 hover:bg-green-600 border-green-500"
                                                )}
                                            >
                                                {viewingRequest.warrantyStatus}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Complaint Description */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Complaint Description</Label>
                                <p className="text-sm p-3 bg-slate-50 rounded border">{viewingRequest.complaintDescription}</p>
                            </div>

                            {/* Rejection Remarks (if rejected) */}
                            {viewingRequest.reason && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Rejection Remarks</Label>
                                    <p className="text-sm p-3 bg-slate-50 rounded border">{viewingRequest.reason}</p>
                                </div>
                            )}

                            {/* Service Action Section - For Submitted status with Accept, NA, or Reject (Under Warranty) */}
                            {viewingRequest.status === "Submitted Request" && (
                                viewingRequest.claim === "Accept" || 
                                viewingRequest.claim === "NA" || 
                                (viewingRequest.claim === "Reject" && viewingRequest.warrantyStatus === "Under Warranty")
                            ) && (
                                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
                                        Service Action
                                    </h3>

                                    <div className="space-y-2">
                                        <Label>Select Action</Label>
                                        <Select
                                            value={viewingRequest.serviceAction}
                                            onValueChange={(value) => handleServiceActionUpdate(value as ServiceAction)}
                                        >
                                            <SelectTrigger className="h-10 bg-white">
                                                <SelectValue placeholder="Select service action" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Repair">Repair</SelectItem>
                                                {/* Replace option only for Accept claim or NA claim, not for Reject */}
                                                {viewingRequest.claim !== "Reject" && (
                                                    <SelectItem value="Replace">Replace</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Repair Section */}
                                    {viewingRequest.serviceAction === "Repair" && (
                                        <div className="space-y-3 mt-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-semibold">Repair Item Parts</Label>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        // Auto-check billable if warranty is expired
                                                        const isBillable = viewingRequest.warrantyStatus === "Expired";
                                                        const newItem: RepairItem = { id: Date.now(), itemName: "", stock: 0, qty: 1, price: 0, billable: isBillable };
                                                        updateViewingRequest({ repairItems: [...(viewingRequest.repairItems || []), newItem] });
                                                    }}
                                                    className="h-8"
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Add Item
                                                </Button>
                                            </div>

                                            <div className="max-h-[300px] overflow-y-auto border rounded-lg bg-white">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50">
                                                            <TableHead className="w-[80px]">Billable</TableHead>
                                                            <TableHead className="w-[50px]">#</TableHead>
                                                            <TableHead>Item Name</TableHead>
                                                            <TableHead className="w-[100px]">Stock</TableHead>
                                                            <TableHead className="w-[100px]">Qty</TableHead>
                                                            <TableHead className="w-[120px]">Price</TableHead>
                                                            <TableHead className="w-[60px]"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {(!viewingRequest.repairItems || viewingRequest.repairItems.length === 0) ? (
                                                            <TableRow>
                                                                <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                                                                    No repair items added
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            viewingRequest.repairItems.map((item, index) => (
                                                                <TableRow key={item.id}>
                                                                    <TableCell className="text-center">
                                                                        <Checkbox
                                                                            checked={item.billable}
                                                                            onCheckedChange={(checked) => {
                                                                                const updatedItems = viewingRequest.repairItems?.map(i =>
                                                                                    i.id === item.id ? { ...i, billable: !!checked } : i
                                                                                );
                                                                                updateViewingRequest({ repairItems: updatedItems });
                                                                            }}
                                                                            className="h-5 w-5"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>{index + 1}</TableCell>
                                                                    <TableCell>
                                                                        <Select
                                                                            value={item.itemName}
                                                                            onValueChange={(value) => {
                                                                                const updatedItems = viewingRequest.repairItems?.map(i =>
                                                                                    i.id === item.id ? { ...i, itemName: value, stock: MOCK_STOCK_DATA[value] || 0 } : i
                                                                                );
                                                                                updateViewingRequest({ repairItems: updatedItems });
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-9">
                                                                                <SelectValue placeholder="Select item" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {REPAIR_ITEMS.map((repairItem) => (
                                                                                    <SelectItem key={repairItem} value={repairItem}>
                                                                                        {repairItem}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Input
                                                                            value={item.stock}
                                                                            disabled
                                                                            className="h-9 bg-slate-50"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            value={item.qty}
                                                                            onChange={(e) => {
                                                                                const updatedItems = viewingRequest.repairItems?.map(i =>
                                                                                    i.id === item.id ? { ...i, qty: parseInt(e.target.value) || 0 } : i
                                                                                );
                                                                                updateViewingRequest({ repairItems: updatedItems });
                                                                            }}
                                                                            className="h-9"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            placeholder="Price"
                                                                            value={item.price}
                                                                            onChange={(e) => {
                                                                                const updatedItems = viewingRequest.repairItems?.map(i =>
                                                                                    i.id === item.id ? { ...i, price: parseFloat(e.target.value) || 0 } : i
                                                                                );
                                                                                updateViewingRequest({ repairItems: updatedItems });
                                                                            }}
                                                                            className="h-9"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                            onClick={() => {
                                                                                const updatedItems = viewingRequest.repairItems?.filter(i => i.id !== item.id);
                                                                                updateViewingRequest({ repairItems: updatedItems });
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                                
                                                {/* Labour Cost Row */}
                                                <div className="border-t p-4 space-y-3 bg-slate-50">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Checkbox
                                                                checked={viewingRequest.labourBillable || false}
                                                                onCheckedChange={(checked) => updateViewingRequest({ labourBillable: !!checked })}
                                                                className="h-5 w-5"
                                                            />
                                                            <Label className="font-semibold">Labour Cost</Label>
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            placeholder="Amount"
                                                            value={viewingRequest.labourCost || 0}
                                                            onChange={(e) => updateViewingRequest({ labourCost: parseFloat(e.target.value) || 0 })}
                                                            className="h-9 w-32"
                                                        />
                                                    </div>
                                                    
                                                    {/* Total Price */}
                                                    <div className="flex items-center justify-between pt-2 border-t">
                                                        <Label className="font-bold text-lg">Total Price</Label>
                                                        <span className="font-bold text-lg text-primary">
                                                            ${((viewingRequest.repairItems || []).reduce((sum, item) => sum + (item.billable ? item.price * item.qty : 0), 0) + (viewingRequest.labourBillable ? (viewingRequest.labourCost || 0) : 0)).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Replace Section */}
                                    {viewingRequest.serviceAction === "Replace" && (
                                        <div className="space-y-3 mt-4">
                                            <Label className="text-sm font-semibold">New Serial Number</Label>
                                            <Input
                                                placeholder="Enter new serial number (FG remains same)"
                                                value={viewingRequest.newSerialNumber || ""}
                                                onChange={(e) => updateViewingRequest({ newSerialNumber: e.target.value })}
                                                className="h-10 border-blue-200 focus:border-blue-400"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Display Service Action for other statuses */}
                            {viewingRequest.status !== "Submitted Request" && viewingRequest.serviceAction && (
                                <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
                                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                                        Service Action Taken
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Service Date</Label>
                                            <p className="font-medium">{viewingRequest.serviceDate ? formatDate(viewingRequest.serviceDate) : "—"}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Action Type</Label>
                                            <p className="font-medium">{viewingRequest.serviceAction}</p>
                                        </div>
                                    </div>

                                    {viewingRequest.serviceAction === "Repair" && viewingRequest.repairItems && viewingRequest.repairItems.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Repair Items Used</Label>
                                            <div className="border rounded-lg bg-white">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50">
                                                            <TableHead className="w-[80px]">Billable</TableHead>
                                                            <TableHead className="w-[50px]">#</TableHead>
                                                            <TableHead>Item Name</TableHead>
                                                            <TableHead className="w-[100px]">Stock</TableHead>
                                                            <TableHead className="w-[100px]">Qty</TableHead>
                                                            <TableHead className="w-[120px]">Price</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {viewingRequest.repairItems.map((item, index) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="text-center">
                                                                    <Checkbox checked={item.billable} disabled className="h-5 w-5" />
                                                                </TableCell>
                                                                <TableCell>{index + 1}</TableCell>
                                                                <TableCell>{item.itemName}</TableCell>
                                                                <TableCell>{item.stock}</TableCell>
                                                                <TableCell>{item.qty}</TableCell>
                                                                <TableCell>${item.price.toFixed(2)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                
                                                {/* Labour Cost and Total Price Display */}
                                                <div className="border-t p-4 space-y-3 bg-slate-50">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Checkbox checked={viewingRequest.labourBillable || false} disabled className="h-5 w-5" />
                                                            <Label className="font-semibold">Labour Cost</Label>
                                                        </div>
                                                        <span className="font-medium">${(viewingRequest.labourCost || 0).toFixed(2)}</span>
                                                    </div>
                                                    
                                                    {/* Total Price */}
                                                    <div className="flex items-center justify-between pt-2 border-t">
                                                        <Label className="font-bold text-lg">Total Price</Label>
                                                        <span className="font-bold text-lg text-primary">
                                                            ${((viewingRequest.repairItems || []).reduce((sum, item) => sum + (item.billable ? item.price * item.qty : 0), 0) + (viewingRequest.labourBillable ? (viewingRequest.labourCost || 0) : 0)).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {viewingRequest.serviceAction === "Replace" && viewingRequest.newSerialNumber && (
                                        <div>
                                            <Label className="text-xs text-muted-foreground">New Serial Number</Label>
                                            <p className="font-mono text-blue-600 font-semibold">{viewingRequest.newSerialNumber}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setIsViewModalOpen(false); setViewingRequest(null); }}>
                            Close
                        </Button>
                        {viewingRequest?.status === "Submitted Request" && (
                            <Button onClick={handleFulfill}>
                                Complete
                            </Button>
                        )}
                        {viewingRequest?.status === "Completed Request" && (
                            <Button onClick={() => handleExportPDF(viewingRequest)} className="gap-2">
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default WarrantyService;
