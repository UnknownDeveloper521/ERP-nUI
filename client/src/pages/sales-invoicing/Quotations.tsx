import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateQuotationPDFHTML } from "@/lib/quotationPDFTemplate";
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
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Trash2,
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronsUpDown,
    Check,
    X,
    Download,
} from "lucide-react";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import React from "react";
// Updated: Import mock quotation service instead of using localStorage
import {
    getQuotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    changeQuotationStatus,
    type QuotationData,
    type QuotationItem,
    type PaymentTerm,
    type QuotationStatus
} from "@/lib/mockQuotations";
import { mockCustomers, allMockMaterials } from "@/lib/masterMockData";

// ============================================================================
// SEARCHABLE SELECT COMPONENT
// ============================================================================

interface Customer {
    name: string;
    contactPerson: string;
    contactNumber: string;
    billingAddress: string;
    shippingAddress: string;
}

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

    // Ensure value is always a string
    const safeValue = value || "";

    return (
        <div className="space-y-2">
            <Label>
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
                        <span className={cn(!safeValue && "text-muted-foreground")}>
                            {safeValue || `Select ${label}`}
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
                                                safeValue === item ? "opacity-100" : "opacity-0"
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

// Removed MOCK_CUSTOMERS and ITEMS - now using centralized mockCustomers and allMockMaterials

const CURRENCIES = ["UGX"];
const PAYMENT_TERM_OPTIONS: Array<"Advance" | "Delivery" | "Days"> = ["Advance", "Delivery", "Days"];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getCurrentDateForInput = () => {
    return format(new Date(), "yyyy-MM-dd");
};

const formatDate = (dateStr: string) => {
    try {
        return format(new Date(dateStr), "dd-MM-yyyy");
    } catch {
        return dateStr;
    }
};

const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'INR': '₹',
        'JPY': '¥',
        'CNY': '¥',
        'AUD': 'A$',
        'CAD': 'C$',
        'CHF': 'CHF',
        'SEK': 'kr',
        'NZD': 'NZ$',
        'UGX': 'USh'
    };
    return symbols[currency] || currency;
};

const calculateItemAmount = (item: QuotationItem): number => {
    try {
        return (item.qty || 0) * (item.rate || 0);
    } catch (error) {
        console.error("Error calculating item amount:", error);
        return 0;
    }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Quotations() {
    const { toast } = useToast();

    // State - removed localStorage - using mock store
    const [quotations, setQuotations] = useState<QuotationData[]>([]);

    // Load quotations on mount
    useEffect(() => {
        setQuotations(getQuotations());
    }, []);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("Draft Quote");
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isNewCustomer, setIsNewCustomer] = useState(true);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewingQuotation, setViewingQuotation] = useState<QuotationData | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [quotationToDelete, setQuotationToDelete] = useState<QuotationData | null>(null);

    const [formData, setFormData] = useState<Partial<QuotationData>>({
        quotationDate: getCurrentDateForInput(),
        customerName: "",
        contactPersonName: "",
        contactNumber: "",
        billingAddress: "",
        shippingAddress: "",
        currency: "UGX",
        paymentTerms: [],
        deliveryTime: getCurrentDateForInput(),
        quotationValidity: getCurrentDateForInput(),
        remarks: "",
        items: [],
        status: "Draft Quote",
        discountValue: 0,
        discountType: "%",
        taxValue: 0,
        taxType: "%",
        taxPercentage: 0,
        subtotal: 0,
        taxAmount: 0,
        total: 0
    });

    // Reset form
    const resetForm = () => {
        setFormData({
            quotationDate: getCurrentDateForInput(),
            customerName: "",
            contactPersonName: "",
            contactNumber: "",
            billingAddress: "",
            shippingAddress: "",
            currency: "UGX",
            paymentTerms: [],
            deliveryTime: getCurrentDateForInput(),
            quotationValidity: getCurrentDateForInput(),
            remarks: "",
            items: [],
            status: "Draft Quote",
            discountValue: 0,
            discountType: "%",
            taxValue: 0,
            taxType: "%",
            taxPercentage: 0,
            subtotal: 0,
            taxAmount: 0,
            total: 0
        });
        setEditingId(null);
        setIsNewCustomer(true);
        setIsManualEntry(false);
    };

    // Handle customer selection
    const handleCustomerSelect = (customerName: string) => {
        try {
            if (customerName === "Manual Entry / New Customer") {
                setIsManualEntry(true);
                setIsNewCustomer(true);
                setFormData({
                    ...formData,
                    customerName: "",
                    contactPersonName: "",
                    contactNumber: "",
                    billingAddress: "",
                    shippingAddress: ""
                });
                return;
            }

            const customer = mockCustomers.find(c => c.name === customerName);
            if (customer) {
                setIsManualEntry(false);
                setIsNewCustomer(false);
                setFormData({
                    ...formData,
                    customerName: customer.name || "",
                    contactPersonName: customer.contactPerson || "",
                    contactNumber: customer.mobileNo || "",
                    billingAddress: customer.billingAddress || "",
                    shippingAddress: customer.shippingAddress || ""
                });
            } else {
                // Customer not found - show error
                toast({
                    title: "Error",
                    description: "Customer not found. Please try again or use Manual Entry.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error selecting customer:", error);
            toast({
                title: "Error",
                description: "An error occurred while selecting the customer. Please try again.",
                variant: "destructive"
            });
        }
    };

    // Create new customer
    const handleCreateCustomer = () => {
        // Validation
        if (!formData.customerName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Customer Name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.contactNumber?.trim()) {
            toast({
                title: "Validation Error",
                description: "Contact Number is required",
                variant: "destructive"
            });
            return;
        }

        if (!/^\d{10,11}$/.test(formData.contactNumber)) {
            toast({
                title: "Validation Error",
                description: "Contact number must be 10 or 11 digits",
                variant: "destructive"
            });
            return;
        }

        if (!formData.billingAddress?.trim()) {
            toast({
                title: "Validation Error",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Check if customer already exists
        const existingCustomer = mockCustomers.find(
            c => c.name.toLowerCase() === (formData.customerName?.trim().toLowerCase() || "")
        );

        if (existingCustomer) {
            toast({
                title: "Customer Exists",
                description: "A customer with this name already exists",
                variant: "destructive"
            });
            return;
        }

        // Create new customer
        const newCustomer = {
            id: `cust-${Date.now()}`,
            name: formData.customerName.trim(),
            contactPerson: formData.contactPersonName?.trim() || "",
            mobileNo: formData.contactNumber.trim(),
            billingAddress: formData.billingAddress.trim(),
            shippingAddress: formData.shippingAddress?.trim() || formData.billingAddress.trim()
        };

        // Add to mockCustomers array
        mockCustomers.push(newCustomer);

        // Switch to non-manual mode and keep the customer selected
        setIsManualEntry(false);
        setIsNewCustomer(false);

        toast({
            title: "Success",
            description: `Customer "${newCustomer.name}" created successfully`
        });
    };

    // Item handlers
    const handleAddItem = () => {
        const newItem: QuotationItem = {
            id: Date.now(),
            itemCode: "",
            item: "",
            qty: 1,
            rate: 0,
            amount: 0
        };
        setFormData({ ...formData, items: [...(formData.items || []), newItem] });
    };

    const handleRemoveItem = (id: number) => {
        setFormData({ ...formData, items: formData.items?.filter(item => item.id !== id) });
    };

    const handleItemChange = (id: number, field: keyof QuotationItem, value: any) => {
        const updatedItems = formData.items?.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                
                // If item name is changed, also update itemCode
                if (field === 'item') {
                    const selectedMaterial = allMockMaterials.find(m => m.name === value);
                    if (selectedMaterial) {
                        updated.itemCode = selectedMaterial.id; // Use id as itemCode
                    }
                }
                
                updated.amount = calculateItemAmount(updated);
                return updated;
            }
            return item;
        });
        setFormData({ ...formData, items: updatedItems });
    };

    // Payment term handlers
    // Add payment term with support for both Percentage and Fixed Amount
    const handleAddPaymentTerm = () => {
        // Get all term types that are already used
        const usedTermTypes = formData.paymentTerms?.map(t => t.terms) || [];

        // Find the first available term type
        let defaultTermType: "Advance" | "Delivery" | "Days" = "Advance";
        if (usedTermTypes.includes("Advance")) {
            defaultTermType = "Delivery";
        }
        if (usedTermTypes.includes("Delivery")) {
            defaultTermType = "Days";
        }

        // Create new term with default value as percentage
        const newTerm: PaymentTerm = {
            id: Date.now(),
            value: 0, // Default value (percentage 0-100)
            percentage: 0, // Kept for backward compatibility
            terms: defaultTermType,
            date: ""
        };
        setFormData({ ...formData, paymentTerms: [...(formData.paymentTerms || []), newTerm] });
    };

    const handleRemovePaymentTerm = (id: number) => {
        setFormData({ ...formData, paymentTerms: formData.paymentTerms?.filter(term => term.id !== id) });
    };

    const handlePaymentTermChange = (id: number, field: keyof PaymentTerm, value: any) => {
        const updatedTerms = formData.paymentTerms?.map(term => {
            if (term.id === id) {
                return { ...term, [field]: value };
            }
            return term;
        });
        setFormData({ ...formData, paymentTerms: updatedTerms });
    };

    const calculatePaymentTermsTotal = () => {
        return (formData.paymentTerms || []).reduce((sum, term) => sum + term.percentage, 0);
    };

    // Calculate totals - Support for both discount and tax as % or Amount (matching Sales Order)
    const calculateTotals = () => {
        try {
            const items = formData.items || [];
            const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
            
            // Calculate discount
            let discountAmount = 0;
            if (formData.discountType === "%") {
                discountAmount = (subtotal * (formData.discountValue || 0)) / 100;
            } else {
                discountAmount = formData.discountValue || 0;
            }
            
            const afterDiscount = subtotal - discountAmount;
            
            // Calculate tax - can be % or fixed amount
            let taxAmount = 0;
            if (formData.taxType === "%") {
                taxAmount = (afterDiscount * (formData.taxValue || 0)) / 100;
            } else {
                taxAmount = formData.taxValue || 0;
            }
            
            const total = afterDiscount + taxAmount;
            return { subtotal, discountAmount, afterDiscount, taxAmount, total };
        } catch (error) {
            console.error("Error calculating totals:", error);
            return { subtotal: 0, discountAmount: 0, afterDiscount: 0, taxAmount: 0, total: 0 };
        }
    };

    // Generate quotation number
    const generateQuotationNo = () => {
        const year = new Date().getFullYear();
        const count = quotations.length + 1;
        return `QT-${year}-${String(count).padStart(3, '0')}`;
    };

    // Save quotation (Draft) - removed localStorage - using mock store
    const handleSave = () => {
        if (isManualEntry) {
            toast({
                title: "Validation Error",
                description: "Please create the customer first before saving",
                variant: "destructive"
            });
            return;
        }

        if (!formData.customerName) {
            toast({
                title: "Validation Error",
                description: "Customer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.billingAddress) {
            toast({
                title: "Validation Error",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if terms exist
        if (formData.paymentTerms && formData.paymentTerms.length > 0) {
            // Validation: Total percentage must equal 100%
            const totalPercentage = formData.paymentTerms.reduce((sum, term) => sum + term.percentage, 0);
            if (totalPercentage !== 100) {
                toast({
                    title: "Validation Error",
                    description: "Total payment percentage must equal 100%.",
                    variant: "destructive"
                });
                return;
            }

            // Validation: Check for zero percentage terms
            const hasZeroPercentage = formData.paymentTerms.some(term => term.percentage === 0);
            if (hasZeroPercentage) {
                toast({
                    title: "Validation Error",
                    description: "Payment percentage cannot be 0%.",
                    variant: "destructive"
                });
                return;
            }
        }

        if (formData.contactNumber && !/^\d{10,11}$/.test(formData.contactNumber)) {
            toast({
                title: "Validation Error",
                description: "Contact number must be 10 or 11 digits",
                variant: "destructive"
            });
            return;
        }

        const totals = calculateTotals();
        
        // Determine status: if editing a Submitted Quote, keep it as Submitted Quote
        const status = (editingId && formData.status === "Submitted Quote") ? "Submitted Quote" : "Draft Quote";
        
        const quotationData: Omit<QuotationData, 'id'> = {
            quotationNo: editingId ? (formData.quotationNo || "") : "",
            quotationDate: formData.quotationDate!,
            customerName: formData.customerName!,
            contactPersonName: formData.contactPersonName || "",
            contactNumber: formData.contactNumber || "",
            billingAddress: formData.billingAddress || "",
            shippingAddress: formData.shippingAddress || "",
            currency: formData.currency || "UGX",
            paymentTerms: formData.paymentTerms || [],
            deliveryTime: formData.deliveryTime || "",
            quotationValidity: formData.quotationValidity || "30 days",
            remarks: formData.remarks || "",
            items: formData.items || [],
            status: status,
            discountValue: formData.discountValue || 0,
            discountType: formData.discountType || "%",
            taxType: formData.taxType || "%",
            taxValue: formData.taxValue || 0,
            taxPercentage: formData.taxValue || 0, // Kept for backward compatibility
            ...totals
        };

        if (editingId) {
            updateQuotation(editingId, quotationData);
            toast({ title: "Success", description: status === "Submitted Quote" ? "Submitted quotation updated successfully" : "Quotation saved as draft" });
        } else {
            createQuotation(quotationData);
            toast({ title: "Success", description: "Quotation saved as draft" });
        }

        setQuotations(getQuotations()); // Refresh list
        setIsFormModalOpen(false);
        resetForm();
    };

    // Submit quotation - removed localStorage - using mock store
    const handleSubmit = () => {
        if (isManualEntry) {
            toast({
                title: "Validation Error",
                description: "Please create the customer first before submitting",
                variant: "destructive"
            });
            return;
        }

        if (!formData.customerName) {
            toast({
                title: "Validation Error",
                description: "Customer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.billingAddress) {
            toast({
                title: "Validation Error",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if terms exist
        if (formData.paymentTerms && formData.paymentTerms.length > 0) {
            // Validation: Total percentage must equal 100%
            const totalPercentage = formData.paymentTerms.reduce((sum, term) => sum + term.percentage, 0);
            if (totalPercentage !== 100) {
                toast({
                    title: "Validation Error",
                    description: "Total payment percentage must equal 100%.",
                    variant: "destructive"
                });
                return;
            }

            // Validation: Check for zero percentage terms
            const hasZeroPercentage = formData.paymentTerms.some(term => term.percentage === 0);
            if (hasZeroPercentage) {
                toast({
                    title: "Validation Error",
                    description: "Payment percentage cannot be 0%.",
                    variant: "destructive"
                });
                return;
            }
        }

        if (formData.contactNumber && !/^\d{10,11}$/.test(formData.contactNumber)) {
            toast({
                title: "Validation Error",
                description: "Contact number must be 10 or 11 digits",
                variant: "destructive"
            });
            return;
        }

        if (!formData.items || formData.items.length === 0) {
            toast({
                title: "Validation Error",
                description: "At least one item is required",
                variant: "destructive"
            });
            return;
        }

        const totals = calculateTotals();
        const quotationData: Omit<QuotationData, 'id'> = {
            quotationNo: editingId ? (formData.quotationNo || generateQuotationNo()) : generateQuotationNo(),
            quotationDate: formData.quotationDate!,
            customerName: formData.customerName!,
            contactPersonName: formData.contactPersonName || "",
            contactNumber: formData.contactNumber || "",
            billingAddress: formData.billingAddress || "",
            shippingAddress: formData.shippingAddress || "",
            currency: formData.currency || "UGX",
            paymentTerms: formData.paymentTerms || [],
            deliveryTime: formData.deliveryTime || "",
            quotationValidity: formData.quotationValidity || "30 days",
            remarks: formData.remarks || "",
            items: formData.items || [],
            status: "Submitted Quote",
            discountValue: formData.discountValue || 0,
            discountType: formData.discountType || "%",
            taxType: formData.taxType || "%",
            taxValue: formData.taxValue || 0,
            taxPercentage: formData.taxValue || 0, // Kept for backward compatibility
            ...totals
        };

        if (editingId) {
            updateQuotation(editingId, quotationData);
            toast({ title: "Success", description: "Quotation submitted successfully" });
        } else {
            createQuotation(quotationData);
            toast({ title: "Success", description: "Quotation submitted successfully" });
        }

        setQuotations(getQuotations()); // Refresh list
        setIsFormModalOpen(false);
        resetForm();
    };

    // Handle edit
    const handleEdit = (quotation: QuotationData) => {
        setFormData({
            quotationNo: quotation.quotationNo,
            quotationDate: quotation.quotationDate,
            customerName: quotation.customerName,
            contactPersonName: quotation.contactPersonName,
            contactNumber: quotation.contactNumber,
            billingAddress: quotation.billingAddress,
            shippingAddress: quotation.shippingAddress,
            currency: quotation.currency,
            paymentTerms: quotation.paymentTerms,
            deliveryTime: quotation.deliveryTime,
            quotationValidity: quotation.quotationValidity,
            remarks: quotation.remarks,
            items: quotation.items,
            status: quotation.status,
            discountValue: quotation.discountValue || 0,
            discountType: quotation.discountType || "%",
            taxType: quotation.taxType || "%",
            taxValue: quotation.taxValue || 0,
            taxPercentage: quotation.taxPercentage || 0
        });
        setEditingId(quotation.id);
        setIsNewCustomer(false);
        setIsManualEntry(false);
        setIsFormModalOpen(true);
    };

    // New: Handle deletion
    const handleDeleteQuotation = (id: number) => {
        deleteQuotation(id);
        setQuotations(getQuotations()); // Refresh list
        setIsDeleteAlertOpen(false);
        setIsFormModalOpen(false);
        toast({
            title: "Quotation Deleted",
            description: "The quotation has been deleted successfully."
        });
    };

    // Export as PDF - Using unified template
    const handleExportPDF = (quotation: QuotationData) => {
        const pdfContent = generateQuotationPDFHTML(quotation);

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
            description: "Preparing quotation for print..."
        });
    };

    // Check for expired quotations - removed localStorage - using mock store
    useEffect(() => {
        const checkExpiredQuotations = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const allQuotations = getQuotations();
            let hasChanges = false;

            allQuotations.forEach(quote => {
                // Only check Submitted Quote quotations
                if (quote.status === "Submitted Quote" && quote.quotationValidity) {
                    const expiryDate = new Date(quote.quotationValidity);
                    expiryDate.setHours(23, 59, 59, 999); // Expire at end of day

                    // If expired, update status
                    if (today > expiryDate) {
                        changeQuotationStatus(quote.id, "Expired Quotations");
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges) {
                setQuotations(getQuotations()); // Refresh list
            }
        };

        // Check on mount
        checkExpiredQuotations();

        // Check every minute
        const interval = setInterval(checkExpiredQuotations, 60000);

        return () => clearInterval(interval);
    }, []);

    // Filter and pagination
    const filteredQuotations = quotations.filter(q => {
        const matchesSearch = q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (q.quotationNo && q.quotationNo.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesDate = filterDate ? q.quotationDate === format(filterDate, "yyyy-MM-dd") : true;
        const matchesStatus = filterStatus === "all" ? true : q.status === filterStatus;
        return matchesSearch && matchesDate && matchesStatus;
    });

    const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);
    const paginatedQuotations = filteredQuotations.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredQuotations.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterDate, filterStatus]);

    const getStatusBadge = (status: QuotationStatus) => {
        switch (status) {
            case "Draft Quote":
                return <Badge variant="outline">Draft Quote</Badge>;
            case "Submitted Quote":
                return <Badge variant="default">Submitted Quote</Badge>;
            case "Expired Quotations":
                return <Badge variant="destructive">Expired Quotations</Badge>;
            case "Converted to SO":
                return <Badge variant="secondary">Converted to SO</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by Quotation No, Customer..."
                }}
                filters={[
                    {
                        type: 'date',
                        label: 'Date',
                        value: filterDate,
                        onChange: (date) => {
                            setFilterDate(date);
                            setCurrentPage(1);
                        },
                        showClear: true
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: filterStatus,
                        options: [{ label: "All Status", value: "all" }, "Draft Quote", "Submitted Quote", "Expired Quotations", "Converted to SO"],
                        onChange: (val) => {
                            setFilterStatus(val);
                            setCurrentPage(1);
                        },
                        searchable: true
                    }
                ]}
                actions={[
                    {
                        label: "New Quotation",
                        icon: <Plus className="h-4 w-4" />,
                        onClick: () => { resetForm(); setIsFormModalOpen(true); }
                    }
                ]}
            />

            {/* Quotation Table - Matching WarrantyService layout */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 pl-6">Quotation No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Quotation Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Customer</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="font-semibold text-xs tracking-wider text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedQuotations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            No quotations found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedQuotations.map((quote) => (
                                        <TableRow key={quote.id} className="hover:bg-muted/30 transition-colors border-b last:border-none">
                                            <TableCell className="py-4 pl-6 font-medium text-xs font-mono text-primary">{quote.quotationNo || `QT-${quote.id}`}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">{formatDate(quote.quotationDate)}</TableCell>
                                            <TableCell className="py-4 text-sm font-bold text-primary">{quote.customerName}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getStatusBadge(quote.status)}
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <TableActionButtons
                                                    onView={() => {
                                                        setViewingQuotation(quote);
                                                        setIsViewModalOpen(true);
                                                    }}
                                                    onEdit={(quote.status === "Draft Quote" || quote.status === "Submitted Quote") ? () => handleEdit(quote) : undefined}
                                                    onDelete={undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* DataTablePagination - matching SO pagination position */}
                    <div className="px-4 py-2 border-t">
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredQuotations.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* New/Edit Quotation Form Modal - layout only - match SO */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent className="sm:max-w-[1200px] max-h-[95vh] flex flex-col p-0">
                    {/* layout only - match SO: Header with title + subtitle + close icon */}
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-2xl font-bold">
                            {editingId ? "Edit Quotation" : "Create Quotation"}
                        </DialogTitle>
                        <DialogDescription>
                            Fill in the details to create or update a quotation.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* layout only - match SO: 2-column grid with proper field placement */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Row 1: Quotation Date | Customer */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Quotation Date</Label>
                                <Input
                                    value={formData.quotationDate}
                                    readOnly
                                    disabled
                                    className="h-10 bg-muted/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <SearchableSelect
                                    label="Customer"
                                    required
                                    value={formData.customerName}
                                    options={["Manual Entry / New Customer", ...mockCustomers.map(c => c.name)]}
                                    onChange={handleCustomerSelect}
                                />
                            </div>

                            {/* Row 2: Customer Name | Contact Person Name */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Customer Name <span className="text-red-500">*</span>
                                    {!isManualEntry && !isNewCustomer && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    placeholder="Enter customer name"
                                    disabled={!isManualEntry}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Contact Person Name
                                    {!isManualEntry && !isNewCustomer && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={formData.contactPersonName}
                                    onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                                    placeholder="Enter contact person"
                                    disabled={!isManualEntry}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>

                            {/* Row 3: Contact Number | Currency */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Contact Number <span className="text-red-500">*</span>
                                    {!isManualEntry && !isNewCustomer && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={formData.contactNumber}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        if (value.length <= 11) {
                                            setFormData({ ...formData, contactNumber: value });
                                        }
                                    }}
                                    placeholder="Enter 10 or 11 digit number"
                                    maxLength={11}
                                    disabled={!isManualEntry}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                                {formData.contactNumber && !/^\d{10,11}$/.test(formData.contactNumber) && (
                                    <p className="text-xs text-red-500">Must be 10 or 11 digits</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <SearchableSelect
                                    label="Currency"
                                    value={formData.currency}
                                    options={CURRENCIES}
                                    onChange={(val) => setFormData({ ...formData, currency: val })}
                                />
                            </div>

                            {/* Row 4: Billing Address | Shipping Address */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Billing Address <span className="text-red-500">*</span>
                                    {!isManualEntry && !isNewCustomer && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={formData.billingAddress}
                                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                                    placeholder="Enter billing address"
                                    disabled={!isManualEntry}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Shipping Address
                                    {!isManualEntry && !isNewCustomer && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={formData.shippingAddress}
                                    onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                                    placeholder="Enter shipping address"
                                    disabled={!isManualEntry}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>

                            {/* Row 5: Quotation Validity | Expected Delivery Date */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Quotation Validity</Label>
                                <DatePicker
                                    date={formData.quotationValidity ? new Date(formData.quotationValidity) : undefined}
                                    setDate={(date) => setFormData({ ...formData, quotationValidity: date ? format(date, "yyyy-MM-dd") : "" })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Expected Delivery Date</Label>
                                <DatePicker
                                    date={formData.deliveryTime ? new Date(formData.deliveryTime) : undefined}
                                    setDate={(date) => setFormData({ ...formData, deliveryTime: date ? format(date, "yyyy-MM-dd") : "" })}
                                />
                            </div>

                            {/* Row 6: Remarks (full width) */}
                            <div className="space-y-2 col-span-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Remarks</Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    placeholder="Additional notes"
                                    className="min-h-[60px]"
                                />
                            </div>
                        </div>

                        {/* layout only - match SO: Terms section with title on left, Add Term button on right */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">Terms</Label>
                                <Button onClick={handleAddPaymentTerm} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Term
                                </Button>
                            </div>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase py-3 pl-6 w-[160px]">Value</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 w-[180px]">Term Type</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-[150px]">Days</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-[120px]">Date</TableHead>
                                            <TableHead className="text-[10px] font-bold py-3 text-center w-[100px]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {!formData.paymentTerms || formData.paymentTerms.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                    No terms added yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            formData.paymentTerms.map((term) => {
                                                // Get all term types that are already used (excluding current term)
                                                const usedTermTypes: Array<"Advance" | "Delivery" | "Days"> = formData.paymentTerms
                                                    ?.filter(t => t.id !== term.id)
                                                    .map(t => t.terms) || [];

                                                return (
                                                    <TableRow key={term.id} className="hover:bg-muted/20">
                                                        {/* Value Column - Simple input without type selector */}
                                                        <TableCell className="py-4 pl-6">
                                                            <Input
                                                                type="number"
                                                                className="h-8 w-32 text-center"
                                                                value={term.value || term.percentage || 0}
                                                                onChange={(e) => {
                                                                    let val = parseFloat(e.target.value) || 0;
                                                                    if (val < 0) val = 0;

                                                                    const updatedTerms = formData.paymentTerms?.map(t => 
                                                                        t.id === term.id 
                                                                            ? { ...t, value: val, percentage: val } 
                                                                            : t
                                                                    );
                                                                    setFormData({ ...formData, paymentTerms: updatedTerms });
                                                                }}
                                                                min="0"
                                                                step="0.01"
                                                            />
                                                        </TableCell>

                                                        {/* Term Type Column */}
                                                        <TableCell className="py-4">
                                                            <Select
                                                                value={term.terms}
                                                                onValueChange={(val: "Advance" | "Delivery" | "Days") => {
                                                                    // Check if this term type is already used
                                                                    if (usedTermTypes.includes(val)) {
                                                                        toast({
                                                                            title: "Duplicate Term Type",
                                                                            description: "This term type is already added.",
                                                                            variant: "destructive"
                                                                        });
                                                                        return;
                                                                    }
                                                                    handlePaymentTermChange(term.id, 'terms', val);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 w-32">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {PAYMENT_TERM_OPTIONS.map(opt => (
                                                                        <SelectItem
                                                                            key={opt}
                                                                            value={opt}
                                                                            disabled={usedTermTypes.includes(opt)}
                                                                        >
                                                                            {opt}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>

                                                        {/* Days Column */}
                                                        <TableCell className="py-4">
                                                            {term.terms === "Days" ? (
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 w-24 text-center"
                                                                    value={term.days || ""}
                                                                    onChange={(e) => handlePaymentTermChange(term.id, 'days', parseInt(e.target.value) || 0)}
                                                                    placeholder="Enter days"
                                                                    min="1"
                                                                    max="365"
                                                                />
                                                            ) : (
                                                                <span className="font-medium text-muted-foreground text-center block">-</span>
                                                            )}
                                                        </TableCell>

                                                        {/* Date Column */}
                                                        <TableCell className="py-4 text-center">
                                                            <span className="font-medium text-muted-foreground">-</span>
                                                        </TableCell>

                                                        {/* Actions Column */}
                                                        <TableCell className="py-4 text-center">
                                                            <TableActionButtons
                                                                onDelete={() => handleRemovePaymentTerm(term.id)}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* layout only - match SO: Items section with title on left, Add Item button on right */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">Items</Label>
                                <Button onClick={handleAddItem} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                </Button>
                            </div>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Item</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Qty</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Rate</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Price</TableHead>
                                            <TableHead className="text-[10px] font-bold py-3 text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formData.items?.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                    No items added yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            formData.items?.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/20">
                                                    <TableCell className="py-4 pl-6 min-w-[200px]">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    className="w-full h-9 justify-between font-normal"
                                                                >
                                                                    {item.item || "Select Item"}
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                                                <Command>
                                                                    <CommandInputBorderless placeholder="Search item..." />
                                                                    <CommandList className="max-h-[200px] overflow-y-auto">
                                                                        <CommandEmpty>No item found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {allMockMaterials.filter(material => material.type === 'FG').map((material) => (
                                                                                <CommandItem
                                                                                    key={material.name}
                                                                                    value={material.name}
                                                                                    onSelect={() => handleItemChange(item.id, 'item', material.name)}
                                                                                >
                                                                                    <Check
                                                                                        className={cn(
                                                                                            "mr-2 h-4 w-4",
                                                                                            item.item === material.name ? "opacity-100" : "opacity-0"
                                                                                        )}
                                                                                    />
                                                                                    {material.name}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            className="h-8 w-20 text-center"
                                                            value={item.qty}
                                                            onChange={(e) => handleItemChange(item.id, 'qty', parseFloat(e.target.value) || 0)}
                                                            min="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            className="h-8 w-24 text-center"
                                                            value={item.rate}
                                                            onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                            min="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="font-bold text-primary">USh {item.amount.toFixed(2)}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <TableActionButtons
                                                            onDelete={() => handleRemoveItem(item.id)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Totals Summary - Added Discount and Tax with type selector */}
                        {formData.items && formData.items.length > 0 && (
                            <div className="flex justify-end">
                                <div className="w-80 space-y-2 p-4 bg-muted/30 rounded-lg border">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Subtotal:</span>
                                        <span className="font-bold">{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().subtotal.toFixed(2)}</span>
                                    </div>
                                    
                                    {/* Discount Row */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-muted-foreground">Discount:</span>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="h-8 w-20 text-center"
                                                    value={formData.discountValue || 0}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        const subtotal = calculateTotals().subtotal;
                                                        
                                                        // Validation
                                                        if (formData.discountType === "%") {
                                                            if (val < 0 || val > 100) {
                                                                toast({
                                                                    title: "Invalid Discount",
                                                                    description: "Percentage must be between 0 and 100",
                                                                    variant: "destructive"
                                                                });
                                                                return;
                                                            }
                                                        } else {
                                                            if (val > subtotal) {
                                                                toast({
                                                                    title: "Invalid Discount",
                                                                    description: "Discount amount cannot exceed subtotal",
                                                                    variant: "destructive"
                                                                });
                                                                return;
                                                            }
                                                        }
                                                        
                                                        setFormData({ ...formData, discountValue: val });
                                                    }}
                                                    min="0"
                                                    max={formData.discountType === "%" ? "100" : undefined}
                                                />
                                                <Select
                                                    value={formData.discountType || "%"}
                                                    onValueChange={(val: "%" | "Amount") => {
                                                        setFormData({ ...formData, discountType: val, discountValue: 0 });
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="%">%</SelectItem>
                                                        <SelectItem value="Amount">Amount</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-red-600 text-sm">-{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().discountAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Tax Row - Similar to Discount with % or Amount support */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-muted-foreground">Tax:</span>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="h-8 w-20 text-center"
                                                    value={formData.taxValue || 0}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        const afterDiscount = calculateTotals().afterDiscount;
                                                        
                                                        // Validation
                                                        if (formData.taxType === "%") {
                                                            if (val < 0 || val > 100) {
                                                                toast({
                                                                    title: "Invalid Tax",
                                                                    description: "Percentage must be between 0 and 100",
                                                                    variant: "destructive"
                                                                });
                                                                return;
                                                            }
                                                        } else {
                                                            if (val < 0) {
                                                                toast({
                                                                    title: "Invalid Tax",
                                                                    description: "Tax amount cannot be negative",
                                                                    variant: "destructive"
                                                                });
                                                                return;
                                                            }
                                                        }
                                                        
                                                        setFormData({ ...formData, taxValue: val });
                                                    }}
                                                    min="0"
                                                />
                                                <Select
                                                    value={formData.taxType || "%"}
                                                    onValueChange={(val: "%" | "Amount") => {
                                                        setFormData({ ...formData, taxType: val, taxValue: 0 });
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 w-16">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="%">%</SelectItem>
                                                        <SelectItem value="Amount">Amount</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-green-600 text-sm">+{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().taxAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between text-lg border-t pt-2">
                                        <span className="font-bold">Grand Total:</span>
                                        <span className="font-bold text-primary">{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* layout only - match SO: Footer action bar aligned right like SO */}
                    <DialogFooter className="p-6 border-t mt-auto gap-2">
                        {formData.status === "Draft Quote" && (
                            <div className="mr-auto">
                                {editingId && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            const quote = quotations.find(q => q.id === editingId);
                                            if (quote) {
                                                setQuotationToDelete(quote);
                                                setIsDeleteAlertOpen(true);
                                            }
                                        }}
                                        className="gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </Button>
                                )}
                            </div>
                        )}
                        <Button variant="outline" onClick={() => setIsFormModalOpen(false)}>
                            Close
                        </Button>
                        {isManualEntry && (
                            <Button
                                variant="secondary"
                                onClick={handleCreateCustomer}
                            >
                                Create Customer
                            </Button>
                        )}
                        <Button variant="secondary" onClick={handleSave}>
                            Save
                        </Button>
                        {/* Hide Submit button when editing a Submitted Quote */}
                        {!(editingId && formData.status === "Submitted Quote") && (
                            <Button onClick={handleSubmit}>
                                Submit
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Quotation Modal - PDF Style Document Preview - Professional Non-Colorful Layout */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            {viewingQuotation && (
                                <div className="p-12">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-800">
                                        <div>
                                            <h1 className="text-3xl font-bold text-gray-900 mb-2">MASTER-ERP</h1>
                                            <p className="text-sm text-gray-600">Industrial Solutions & Services</p>
                                            <p className="text-sm text-gray-600">Ahmedabad, Gujarat, India</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-gray-900 mb-1">QUOTATION</h2>
                                            <p className="text-sm text-gray-600">#{viewingQuotation.quotationNo || 'DRAFT'}</p>
                                        </div>
                                    </div>

                                    {/* Quotation Details Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                            Quotation Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quotation Number</p>
                                                <p className="text-sm font-semibold text-gray-900">{viewingQuotation.quotationNo || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quotation Date</p>
                                                <p className="text-sm font-semibold text-gray-900">{formatDate(viewingQuotation.quotationDate)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quotation Validity Date</p>
                                                <p className="text-sm font-semibold text-gray-900">{formatDate(viewingQuotation.quotationValidity)}</p>
                                            </div>
                                            {viewingQuotation.deliveryTime && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected Delivery Date</p>
                                                    <p className="text-sm font-semibold text-gray-900">{formatDate(viewingQuotation.deliveryTime)}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Currency</p>
                                                <p className="text-sm font-semibold text-gray-900">{viewingQuotation.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                            Customer Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Customer Name</p>
                                                <p className="text-sm font-semibold text-gray-900">{viewingQuotation.customerName}</p>
                                            </div>
                                            {viewingQuotation.contactPersonName && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contact Person Name</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.contactPersonName}</p>
                                                </div>
                                            )}
                                            {viewingQuotation.contactNumber && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contact Number</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.contactNumber}</p>
                                                </div>
                                            )}
                                            {viewingQuotation.billingAddress && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Billing Address</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.billingAddress}</p>
                                                </div>
                                            )}
                                            {viewingQuotation.shippingAddress && (
                                                <div className="col-span-2">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Shipping Address</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.shippingAddress}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    {viewingQuotation.remarks && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                                Remarks
                                            </h3>
                                            <p className="text-sm text-gray-800 leading-relaxed">{viewingQuotation.remarks}</p>
                                        </div>
                                    )}

                                    {/* Payment Terms Section - Only Payment Terms */}
                                    {viewingQuotation.paymentTerms && viewingQuotation.paymentTerms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                                Payment Terms
                                            </h3>
                                            <div className="space-y-2">
                                                {viewingQuotation.paymentTerms.map((term, index) => {
                                                    const value = term.value || term.percentage || 0;
                                                    const displayValue = `${value}%`;
                                                    
                                                    let termText = "";
                                                    let termDate = "";
                                                    
                                                    if (term.terms === "Advance") {
                                                        termText = `${displayValue} Advance`;
                                                        termDate = formatDate(viewingQuotation.quotationDate);
                                                    } else if (term.terms === "Delivery") {
                                                        termText = `${displayValue} Delivery`;
                                                        termDate = "On delivery";
                                                    } else if (term.terms === "Days") {
                                                        termText = `${displayValue} within ${term.days || 0} days`;
                                                        termDate = `${term.days || 0} days from invoice`;
                                                    }
                                                    
                                                    return (
                                                        <div key={term.id} className="flex items-start gap-2">
                                                            <span className="text-gray-900 font-bold mt-0.5">•</span>
                                                            <p className="text-sm text-gray-800">{termText} – {termDate}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                            Items
                                        </h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                        Item
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                        Rate
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                        Amount
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewingQuotation.items.map((item, index) => (
                                                    <tr key={item.id} className="border-b border-gray-200">
                                                        <td className="text-sm text-gray-900 py-3 px-4">
                                                            {item.item}
                                                        </td>
                                                        <td className="text-sm text-gray-900 text-right py-3 px-4">
                                                            {item.qty}
                                                        </td>
                                                        <td className="text-sm text-gray-900 text-right py-3 px-4">
                                                            {getCurrencySymbol(viewingQuotation.currency)} {item.rate.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-gray-900 text-right py-3 px-4">
                                                            {getCurrencySymbol(viewingQuotation.currency)} {item.amount.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Financial Summary Section - Non-Colorful */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-80 border border-gray-300">
                                            <div className="flex justify-between items-center py-2 px-4 bg-gray-100 border-b border-gray-200">
                                                <span className="text-sm text-gray-600">Subtotal</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {getCurrencySymbol(viewingQuotation.currency)} {viewingQuotation.subtotal.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
                                                <span className="text-sm text-gray-600">
                                                    Discount ({viewingQuotation.discountType === "%" ? `${viewingQuotation.discountValue || 0}%` : "Amount"})
                                                </span>
                                                <span className="text-sm font-semibold text-red-600">
                                                    -{getCurrencySymbol(viewingQuotation.currency)} {(viewingQuotation.discountAmount || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
                                                <span className="text-sm text-gray-600">
                                                    Tax ({viewingQuotation.taxType === "%" ? `${viewingQuotation.taxValue || viewingQuotation.taxPercentage}%` : "Amount"})
                                                </span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {getCurrencySymbol(viewingQuotation.currency)} {viewingQuotation.taxAmount.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 px-4 bg-gray-800 text-white">
                                                <span className="text-base font-bold">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {getCurrencySymbol(viewingQuotation.currency)} {viewingQuotation.total.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pt-6 border-t border-gray-300">
                                        <p className="text-xs text-gray-500 mb-1">
                                            This is a computer-generated quotation document.
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Outside Document */}
                    <div className="flex justify-between items-center p-4 border-t bg-white">
                        <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                            <X className="mr-2 h-4 w-4" />
                            Close
                        </Button>
                        <div className="flex gap-2">
                            {viewingQuotation && (
                                <Button onClick={() => handleExportPDF(viewingQuotation)} className="gap-2">
                                    <Download className="h-4 w-4" />
                                    Download PDF
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert */}
            <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Are you sure?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete the quotation {quotationToDelete?.quotationNo || 'Draft'}. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteAlertOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => quotationToDelete && handleDeleteQuotation(quotationToDelete.id)}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// DatePicker Component (from Attendance.tsx)
function DatePicker({ date, setDate, disabled = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const monthNamesShort = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const formatDisplayDate = (date: Date | undefined) => {
        if (!date) return "Pick a date";
        try {
            return format(date, "dd/MM/yyyy");
        } catch (error) {
            return "Pick a date";
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        setDate(selectedDate);
        setIsOpen(false);
        setViewMode("day");
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(visibleDate.getFullYear(), monthIndex, 1);
        setVisibleDate(newDate);
        setViewMode("day");
    };

    const handleYearSelect = (year: number) => {
        const newDate = new Date(year, visibleDate.getMonth(), 1);
        setVisibleDate(newDate);
        setViewMode("month");
    };

    const navigateMonth = (direction: number) => {
        const newDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + direction, 1);
        setVisibleDate(newDate);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];

        // Previous month's trailing days
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonth.getDate() - i);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected
            });
        }

        // Next month's leading days
        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayDate = new Date(year, month + 1, day);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false
            });
        }

        return days;
    };

    const renderDayView = () => {
        const days = getDaysInMonth(visibleDate);
        const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("month")}
                        >
                            {monthNames[visibleDate.getMonth()]}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("year")}
                        >
                            {visibleDate.getFullYear()}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => (
                        <Button
                            key={index}
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
                            )}
                            onClick={() => handleDateSelect(day.date)}
                        >
                            {day.date.getDate()}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewMode("day")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{visibleDate.getFullYear()}</h3>
                    <Button
                        variant="ghost"
                        className="font-semibold text-sm"
                        onClick={() => setViewMode("year")}
                    >
                        {visibleDate.getFullYear()}
                        <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {monthNamesShort.map((month, index) => (
                        <Button
                            key={month}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                index === visibleDate.getMonth() && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleMonthSelect(index)}
                        >
                            {month}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderYearView = () => {
        const currentYear = visibleDate.getFullYear();
        const startYear = Math.floor(currentYear / 12) * 12;
        const years = Array.from({ length: 12 }, (_, i) => startYear + i);

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear - 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear + 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => (
                        <Button
                            key={year}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                year === currentYear && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleYearSelect(year)}
                        >
                            {year}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-[9999]" align="start" side="bottom" sideOffset={4}>
                {viewMode === "day" && renderDayView()}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "year" && renderYearView()}
            </PopoverContent>
        </Popover>
    );
}
