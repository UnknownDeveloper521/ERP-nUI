import { useState, useEffect, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Package, X, Edit, Loader2 } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInputBorderless,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { vendorsApi, commonApi, VendorLocation } from "@/lib/api";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 border-b pb-1.5">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
    </div>
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\d{10}$/;

/** Green styling for successful create / update / delete toasts. */
const crudSuccessToast = {
    className: "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

interface VendorItemLink {
    id?: number;
    item_id: number;
    item_name?: string;
    item_code?: string;
    cost_per_unit: number;
    delivery_time_days: number;
}

interface VendorFormData {
    code?: string;
    name?: string;
    contact_person_name?: string;
    mobile_number?: string;
    email?: string;
    payment_terms_id?: number;
    additional_notes?: string;
    vendor_locations?: VendorLocation[];
}

export default function Vendors() {
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const permissionModule = "GENERAL/VENDORS";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [vendors, setVendors] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
    const [isFormDialogPrepLoading, setIsFormDialogPrepLoading] = useState(false);
    const [isVendorItemsLoading, setIsVendorItemsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const openingEditIdRef = useRef<number | null>(null);
    const openingVendorItemsIdRef = useRef<number | null>(null);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<VendorFormData>({});
    const [originalLocations, setOriginalLocations] = useState<VendorLocation[]>([]);

    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [activeVendorId, setActiveVendorId] = useState<number | null>(null);
    const [vendorItems, setVendorItems] = useState<VendorItemLink[]>([]);
    const [originalVendorItems, setOriginalVendorItems] = useState<VendorItemLink[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [vendorToDelete, setVendorToDelete] = useState<number | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Dropdown data
    const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [citiesByLocation, setCitiesByLocation] = useState<Record<number, any[]>>({});
    const [items, setItems] = useState<any[]>([]);

    // Load vendors
    const loadVendors = async () => {
        setIsListLoading(true);
        try {
            const response = await vendorsApi.getList({
                page: currentPage,
                limit: itemsPerPage,
                search: searchTerm || undefined,
            });
            if (response.isSuccessful && response.data) {
                setVendors(response.data.records || []);
                setTotalRecords(response.data.pagination?.total_records || 0);
                setTotalPages(response.data.pagination?.total_pages || 0);
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load vendors" });
        } finally {
            setIsListLoading(false);
        }
    };

    // Load dropdowns
    const loadDropdowns = async () => {
        try {
            // console.log('Loading dropdowns...');
            const [ptRes, itemsRes] = await Promise.all([
                commonApi.getPaymentTerms(1),
                commonApi.getItemsDropdown(),
            ]);
            
            /*
            console.log('Payment Terms Response:', ptRes);
            console.log('Items Response:', itemsRes);
            */
            
            if (ptRes.isSuccessful && ptRes.data) {
                setPaymentTerms(ptRes.data.records || []);
                // console.log('Payment Terms loaded:', ptRes.data.records?.length);
            }
            
            if (itemsRes.isSuccessful && itemsRes.data) {
                const allItems = itemsRes.data.records || [];
                // console.log('Sample item structure:', allItems[0]);
                
                // Filter to show only Raw material items
                const rawMaterialItems = allItems.filter((item: any) => {
                    const itemType = item.item_type_name || item.item_type || item.type_name || '';
                    return itemType.toLowerCase().includes('raw material') || itemType.toLowerCase() === 'raw';
                });
                
                setItems(rawMaterialItems);
                /*
                console.log('Total items:', allItems.length, 'Raw material items:', rawMaterialItems.length);
                console.log('Filtered items sample:', rawMaterialItems.slice(0, 3));
                */
            }
        } catch (error: any) {
            console.error("Failed to load dropdowns:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load dropdown data" });
        }
    };

    // Load states only when needed (when form opens)
    const loadStates = async () => {
        try {
            console.log('Loading states...');
            const statesRes = await commonApi.getStates(undefined, 1);
            console.log('States Response:', statesRes);
            
            if (statesRes.isSuccessful && statesRes.data) {
                const transformedStates = (statesRes.data.records || []).map((state: any) => ({
                    id: state.id,
                    name: state.state_name || state.name,
                    state_code: state.state_code,
                    country_id: state.country_id,
                }));
                setStates(transformedStates);
                console.log('States loaded:', transformedStates.length);
            }
        } catch (error: any) {
            console.error("Failed to load states:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load states" });
        }
    };

    useEffect(() => {
        loadVendors();
    }, [currentPage, itemsPerPage, searchTerm]);

    useEffect(() => {
        loadDropdowns();
    }, []);

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setIsFormDetailLoading(false);
            setIsFormDialogPrepLoading(false);
            openingEditIdRef.current = null;
            setEditingId(null);
        }
    };

    const handleItemDialogOpenChange = (open: boolean) => {
        setIsItemDialogOpen(open);
        if (!open) {
            setIsVendorItemsLoading(false);
            openingVendorItemsIdRef.current = null;
            setActiveVendorId(null);
        }
    };

    const handleAddClick = async () => {
        setEditingId(null);
        setValidationErrors({});
        setFormData({
            vendor_locations: [{ address_line: "", country_id: undefined, state_id: undefined, city_id: undefined }],
        });
        setOriginalLocations([]);
        setIsDialogOpen(true);
        setIsFormDialogPrepLoading(true);
        try {
            await loadStates();
        } finally {
            setIsFormDialogPrepLoading(false);
        }
    };

    const handleEditClick = async (vendor: any) => {
        if (openingEditIdRef.current !== null) return;
        openingEditIdRef.current = vendor.id;
        setEditingId(vendor.id);
        setValidationErrors({});
        setIsDialogOpen(true);
        setIsFormDetailLoading(true);
        try {
            await loadStates();
            const response = await vendorsApi.getById(vendor.id);
            if (response.isSuccessful && response.data && response.data.records && response.data.records.length > 0) {
                const vendorData = response.data.records[0];
                setFormData({
                    code: vendorData.code,
                    name: vendorData.name,
                    contact_person_name: vendorData.contact_person_name,
                    mobile_number: vendorData.mobile_number,
                    email: vendorData.email || "",
                    payment_terms_id: vendorData.payment_terms_id,
                    additional_notes: vendorData.additional_notes || "",
                    vendor_locations: vendorData.vendor_locations || [],
                });
                setOriginalLocations(vendorData.vendor_locations || []);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: response.message || "Failed to load vendor details",
                });
                handleDialogOpenChange(false);
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load vendor details" });
            handleDialogOpenChange(false);
        } finally {
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
        }
    };

    const handleDeleteClick = (id: number) => {
        setVendorToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (vendorToDelete !== null) {
            try {
                const response = await vendorsApi.delete(vendorToDelete);
                if (response.isSuccessful) {
                    toast({ ...crudSuccessToast, title: "Deleted", description: response.message || "Vendor deleted successfully" });
                    loadVendors();
                    setIsDialogOpen(false);
                } else {
                    toast({ variant: "destructive", title: "Error", description: response.message });
                }
            } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete vendor" });
            } finally {
                setVendorToDelete(null);
                setIsDeleteDialogOpen(false);
            }
        }
    };

    const handleSave = async () => {
        // Clear previous validation errors
        setValidationErrors({});
        
        // Validate required fields
        const errors: Record<string, string> = {};
        
        if (!formData.code || formData.code.trim().length === 0) {
            errors.code = "Vendor code is required";
        } else if (formData.code.trim().length < 2) {
            errors.code = "Minimum 2 characters required";
        }
        
        if (!formData.name || formData.name.trim().length === 0) {
            errors.name = "Vendor name is required";
        } else if (formData.name.trim().length < 2) {
            errors.name = "Minimum 2 characters required";
        }
        
        if (!formData.contact_person_name || formData.contact_person_name.trim().length === 0) {
            errors.contact_person_name = "Contact person name is required";
        }
        
        if (!formData.mobile_number || formData.mobile_number.trim().length === 0) {
            errors.mobile_number = "Mobile number is required";
        } else if (!PHONE_REGEX.test(formData.mobile_number)) {
            errors.mobile_number = "Mobile number must be 10 digits";
        }
        
        if (formData.email && !EMAIL_REGEX.test(formData.email)) {
            errors.email = "Please enter a valid email address";
        }
        
        if (!formData.payment_terms_id) {
            errors.payment_terms_id = "Payment terms is required";
        }
        
        // If there are validation errors, show them and return
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            toast({ 
                variant: "destructive", 
                title: "Validation Error", 
                description: "Please fill all required fields correctly." 
            });
            return;
        }

        if (!formData.vendor_locations || formData.vendor_locations.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "At least one address is required." });
            return;
        }

        const invalidAddr = formData.vendor_locations.find(a => !a.address_line || !a.state_id || !a.city_id);
        if (invalidAddr) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please complete all fields in address blocks." });
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                // Update logic
                const addLocations = formData.vendor_locations!.filter(loc => !loc.vendor_location_id);
                const updateLocations = formData.vendor_locations!.filter(loc => loc.vendor_location_id);
                const deleteLocations = originalLocations
                    .filter(orig => !formData.vendor_locations!.some(loc => loc.vendor_location_id === orig.vendor_location_id))
                    .map(loc => ({ vendor_location_id: loc.vendor_location_id! }));

                const response = await vendorsApi.update(editingId, {
                    code: formData.code,
                    name: formData.name,
                    contact_person_name: formData.contact_person_name,
                    mobile_number: formData.mobile_number,
                    email: formData.email,
                    payment_terms_id: formData.payment_terms_id,
                    additional_notes: formData.additional_notes,
                    add_vendor_locations: addLocations.length > 0 ? addLocations : undefined,
                    update_vendor_locations: updateLocations.length > 0 ? updateLocations : undefined,
                    delete_vendor_locations: deleteLocations.length > 0 ? deleteLocations : undefined,
                });
                if (response.isSuccessful) {
                    toast({ ...crudSuccessToast, title: "Updated", description: response.message || "Vendor updated successfully" });
                    loadVendors();
                    setIsDialogOpen(false);
                } else {
                    toast({ variant: "destructive", title: "Error", description: response.message });
                }
            } else {
                // Create logic
                const response = await vendorsApi.create({
                    code: formData.code!,
                    name: formData.name!,
                    contact_person_name: formData.contact_person_name!,
                    mobile_number: formData.mobile_number!,
                    email: formData.email,
                    payment_terms_id: formData.payment_terms_id!,
                    additional_notes: formData.additional_notes,
                    vendor_locations: formData.vendor_locations!,
                });
                if (response.isSuccessful) {
                    toast({ ...crudSuccessToast, title: "Created", description: response.message || "Vendor created successfully" });
                    loadVendors();
                    setIsDialogOpen(false);
                } else {
                    toast({ variant: "destructive", title: "Error", description: response.message });
                }
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save vendor" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleVendorItemsClick = async (vendor: any) => {
        if (openingVendorItemsIdRef.current !== null) return;
        openingVendorItemsIdRef.current = vendor.id;
        setActiveVendorId(vendor.id);
        setVendorItems([]);
        setOriginalVendorItems([]);
        setIsItemDialogOpen(true);
        setIsVendorItemsLoading(true);
        try {
            const response = await vendorsApi.getVendorItems(vendor.id);
            if (response.isSuccessful && response.data) {
                setVendorItems(response.data.records || []);
                setOriginalVendorItems(response.data.records || []);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: response.message || "Failed to load vendor items",
                });
                handleItemDialogOpenChange(false);
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load vendor items" });
            handleItemDialogOpenChange(false);
        } finally {
            setIsVendorItemsLoading(false);
            openingVendorItemsIdRef.current = null;
        }
    };

    const handleSaveVendorItems = async () => {
        if (activeVendorId === null) return;

        const addItems = vendorItems.filter(vi => !vi.id).map(vi => ({
            item_id: vi.item_id,
            cost_per_unit: vi.cost_per_unit,
            delivery_time_days: vi.delivery_time_days,
        }));

        const updateItems = vendorItems.filter(vi => vi.id && originalVendorItems.some(orig => orig.id === vi.id)).map(vi => ({
            vendor_item_id: vi.id!,
            cost_per_unit: vi.cost_per_unit,
            delivery_time_days: vi.delivery_time_days,
        }));

        const deleteItems = originalVendorItems
            .filter(orig => !vendorItems.some(vi => vi.id === orig.id))
            .map(orig => ({ vendor_item_id: orig.id! }));

        try {
            const response = await vendorsApi.saveVendorItems(activeVendorId, {
                add_vendor_items: addItems.length > 0 ? addItems : undefined,
                update_vendor_items: updateItems.length > 0 ? updateItems : undefined,
                delete_vendor_items: deleteItems.length > 0 ? deleteItems : undefined,
            });
            if (response.isSuccessful) {
                toast({ ...crudSuccessToast, title: "Updated", description: response.message || "Vendor items updated successfully" });
                setIsItemDialogOpen(false);
            } else {
                toast({ variant: "destructive", title: "Error", description: response.message });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save vendor items" });
        }
    };

    // Check if all required fields are filled
    const isFormValid = () => {
        return !!(
            formData.code?.trim() &&
            formData.code.trim().length >= 2 &&
            formData.name?.trim() &&
            formData.name.trim().length >= 2 &&
            formData.contact_person_name?.trim() &&
            formData.mobile_number?.trim() &&
            formData.mobile_number.length === 10 &&
            formData.payment_terms_id &&
            (!formData.email || EMAIL_REGEX.test(formData.email)) &&
            formData.vendor_locations &&
            formData.vendor_locations.length > 0 &&
            formData.vendor_locations.every(loc => loc.address_line?.trim() && loc.state_id && loc.city_id)
        );
    };

    const handleStateChange = async (locationIndex: number, stateId: number) => {
        try {
            console.log('Loading cities for state:', stateId, 'location index:', locationIndex);
            const response = await commonApi.getCities(stateId, undefined, 1);
            console.log('Cities Response:', response);
            
            if (response.isSuccessful && response.data) {
                // Transform city_name to name for consistency
                const transformedCities = (response.data.records || []).map((city: any) => ({
                    id: city.id,
                    name: city.city_name || city.name,
                    city_code: city.city_code,
                    state_id: city.state_id,
                }));
                // Store cities for this specific location
                setCitiesByLocation(prev => ({
                    ...prev,
                    [locationIndex]: transformedCities
                }));
                console.log('Cities loaded for location', locationIndex, ':', transformedCities.length);
            }
        } catch (error: any) {
            console.error("Failed to load cities:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load cities" });
        }
        setFormData({
            ...formData,
            vendor_locations: formData.vendor_locations!.map((loc, idx) =>
                idx === locationIndex
                    ? { ...loc, state_id: stateId, city_id: undefined }
                    : loc
            ),
        });
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Vendors Master</h1>
                <p className="text-muted-foreground text-sm">Manage your suppliers, their locations, and supplied items.</p>
            </div>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by vendor name, code..."
                }}
                actions={[
                    ...(canCreate(permissionModule) ? [{
                        label: 'Add New Vendor',
                        icon: <Plus className="h-4 w-4 mr-2" />,
                        onClick: handleAddClick,
                        variant: 'default' as const
                    }] : [])
                ]}
            />

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[120px]">Code</TableHead>
                                    <TableHead>Vendor Name</TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>Payment Terms</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : vendors.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No vendors found matching your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    vendors.map((vendor) => (
                                        <TableRow key={vendor.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-mono text-sm font-medium">{vendor.code}</TableCell>
                                            <TableCell className="font-medium text-sm">{vendor.name}</TableCell>
                                            <TableCell className="text-sm">{vendor.contact_person_name || "-"}</TableCell>
                                            <TableCell className="text-sm">{vendor.mobile_number || "-"}</TableCell>
                                            <TableCell className="text-sm">{vendor.payment_terms_name || "-"}</TableCell>
                                            <TableCell className="text-center">
                                                <TableActionButtons
                                                    customActions={
                                                        <>
                                                            {canEdit(permissionModule) && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                                                                    title="Supplied Items" 
                                                                    onClick={() => { void handleVendorItemsClick(vendor); }}
                                                                >
                                                                    <Package className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {canEdit(permissionModule) && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-muted-foreground hover:text-primary" 
                                                                    onClick={() => { void handleEditClick(vendor); }}
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {!isListLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalRecords}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Vendor Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent 
                    className="!flex min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 grow-0 space-y-1 p-4 pb-1.5">
                        <DialogTitle className="text-lg">{editingId ? "Edit Vendor" : "Create New Vendor"}</DialogTitle>
                        <DialogDescription className="text-xs leading-snug">
                            Enter vendor details, contact information and office locations.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5">
                        {(isFormDetailLoading || isFormDialogPrepLoading) && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        )}
                    <div className="grid gap-4 pt-3 pb-2">
                        <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="code" className="text-xs font-semibold">Vendor Code *</Label>
                                <Input
                                    id="code"
                                    value={formData.code || ""}
                                    onChange={(e) => {
                                        const value = e.target.value.toUpperCase();
                                        setFormData({ ...formData, code: value });
                                        // Real-time validation
                                        if (value.trim().length > 0 && value.trim().length < 2) {
                                            setValidationErrors({ ...validationErrors, code: "Minimum 2 characters required" });
                                        } else {
                                            setValidationErrors({ ...validationErrors, code: "" });
                                        }
                                    }}
                                    className={cn("h-8 w-full", validationErrors.code && "border-red-500 focus-visible:ring-red-500")}
                                />
                                {validationErrors.code && (
                                    <p className="text-xs text-red-500 mt-1">{validationErrors.code}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="name" className="text-xs font-semibold">Vendor Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ""}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setFormData({ ...formData, name: value });
                                        // Real-time validation
                                        if (value.trim().length > 0 && value.trim().length < 2) {
                                            setValidationErrors({ ...validationErrors, name: "Minimum 2 characters required" });
                                        } else {
                                            setValidationErrors({ ...validationErrors, name: "" });
                                        }
                                    }}
                                    className={cn("h-8 w-full", validationErrors.name && "border-red-500 focus-visible:ring-red-500")}
                                />
                                {validationErrors.name && (
                                    <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>
                                )}
                            </div>
                        </div>

                        <SectionHeader title="Primary Contact" />
                        <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="contact_person_name" className="text-xs font-semibold">Contact Person Name *</Label>
                                <Input
                                    id="contact_person_name"
                                    value={formData.contact_person_name || ""}
                                    onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                                    className="h-8 w-full"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="mobile_number" className="text-xs font-semibold">Mobile Number *</Label>
                                <Input
                                    id="mobile_number"
                                    value={formData.mobile_number || ""}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        // Only allow numbers
                                        const numericValue = value.replace(/[^0-9]/g, '');
                                        // Limit to 10 digits
                                        const limitedValue = numericValue.slice(0, 10);
                                        setFormData({ ...formData, mobile_number: limitedValue });
                                        
                                        // Real-time validation
                                        if (limitedValue.length > 0 && limitedValue.length < 10) {
                                            setValidationErrors({ ...validationErrors, mobile_number: "Mobile number must be 10 digits" });
                                        } else {
                                            setValidationErrors({ ...validationErrors, mobile_number: "" });
                                        }
                                    }}
                                    className={cn("h-8 w-full", validationErrors.mobile_number && "border-red-500 focus-visible:ring-red-500")}
                                    maxLength={10}
                                />
                                {validationErrors.mobile_number && (
                                    <p className="text-xs text-red-500 mt-1">{validationErrors.mobile_number}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email || ""}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setFormData({ ...formData, email: value });
                                        
                                        // Real-time validation - only validate if user has entered something
                                        if (value.trim().length > 0) {
                                            if (!EMAIL_REGEX.test(value)) {
                                                setValidationErrors(prev => ({ ...prev, email: "Please enter a valid email address" }));
                                            } else {
                                                setValidationErrors(prev => ({ ...prev, email: "" }));
                                            }
                                        } else {
                                            setValidationErrors(prev => ({ ...prev, email: "" }));
                                        }
                                    }}
                                    className={cn("h-8 w-full", validationErrors.email && "border-red-500 focus-visible:ring-red-500")}
                                />
                                {validationErrors.email && (
                                    <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="payment_terms_id" className="text-xs font-semibold">Payment Terms *</Label>
                                <Select
                                    value={formData.payment_terms_id?.toString() || ""}
                                    onValueChange={(val) => setFormData({ ...formData, payment_terms_id: parseInt(val) })}
                                >
                                    <SelectTrigger id="payment_terms_id" className="h-8 w-full">
                                        <SelectValue placeholder="Select Payment Terms" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {paymentTerms.map((pt) => (
                                            <SelectItem key={pt.id} value={pt.id.toString()}>{pt.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <SectionHeader title="Office Locations" />
                        <div className="space-y-3">
                            {formData.vendor_locations?.map((loc, idx) => (
                                <div key={loc.vendor_location_id || idx} className="relative rounded-md border bg-muted/20 p-3">
                                    {formData.vendor_locations!.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 absolute top-2 right-2 text-destructive"
                                            onClick={() => setFormData({
                                                ...formData,
                                                vendor_locations: formData.vendor_locations!.filter((_, i) => i !== idx)
                                            })}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address Line {idx + 1} *</Label>
                                            <Input
                                                value={loc.address_line}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    vendor_locations: formData.vendor_locations!.map((l, i) => i === idx ? { ...l, address_line: e.target.value } : l)
                                                })}
                                                className="h-8 w-full"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">State *</Label>
                                            <Select
                                                value={loc.state_id?.toString() || ""}
                                                onValueChange={(val) => handleStateChange(idx, parseInt(val))}
                                            >
                                                <SelectTrigger className="h-8 w-full">
                                                    <SelectValue placeholder="Select State" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {states.map(state => (
                                                        <SelectItem key={state.id} value={state.id.toString()}>{state.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">City *</Label>
                                            <Select
                                                value={loc.city_id?.toString() || ""}
                                                onValueChange={(val) => setFormData({
                                                    ...formData,
                                                    vendor_locations: formData.vendor_locations!.map((l, i) => i === idx ? { ...l, city_id: parseInt(val) } : l)
                                                })}
                                                disabled={!loc.state_id}
                                            >
                                                <SelectTrigger className="h-8 w-full">
                                                    <SelectValue placeholder={loc.state_id ? "Select City" : "Select state first"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(citiesByLocation[idx] || []).map(city => (
                                                        <SelectItem key={city.id} value={city.id.toString()}>{city.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className="h-7 w-full border-dashed text-xs"
                                onClick={() => setFormData({
                                    ...formData,
                                    vendor_locations: [...(formData.vendor_locations || []), { address_line: "", country_id: undefined, state_id: undefined, city_id: undefined }]
                                })}
                            >
                                <Plus className="h-3 w-3 mr-1" /> Add Another Location
                            </Button>
                        </div>

                        <SectionHeader title="Additional Notes" />
                        <div className="space-y-1.5">
                            <Textarea
                                value={formData.additional_notes || ""}
                                onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                                placeholder="Any internal notes or special instructions for this vendor..."
                                className="min-h-[56px] w-full resize-none py-2"
                            />
                        </div>
                    </div>
                    </div>

                    <DialogFooter className={cn("shrink-0 gap-2 border-t bg-background px-5 pb-4 pt-3", editingId ? "sm:justify-between" : "sm:justify-end")}>
                        {editingId && canDelete(permissionModule) && (
                            <Button
                                variant="destructive"
                                onClick={() => handleDeleteClick(editingId)}
                                disabled={isSaving || isFormDetailLoading || isFormDialogPrepLoading}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleDialogOpenChange(false)}
                                disabled={isSaving || isFormDetailLoading || isFormDialogPrepLoading}
                            >
                                Cancel
                            </Button>
                            {((editingId && canEdit(permissionModule)) || (!editingId && canCreate(permissionModule))) && (
                                <Button 
                                    onClick={handleSave} 
                                    className="bg-primary hover:bg-primary/90"
                                    loading={isSaving}
                                    disabled={!isFormValid() || isFormDetailLoading || isFormDialogPrepLoading}
                                >
                                    {editingId ? "Update Vendor" : "Create Vendor"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Vendor Items Dialog */}
            <Dialog open={isItemDialogOpen} onOpenChange={handleItemDialogOpenChange}>
                <DialogContent className="flex w-[95%] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
                    <DialogHeader className="space-y-2 p-6 pb-5">
                        <DialogTitle>Manage Supplied Items</DialogTitle>
                        <DialogDescription>
                            Map items that this vendor supplies along with cost and lead time.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative overflow-x-hidden px-6 pb-1">
                        {isVendorItemsLoading && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        )}
                    <div className="space-y-9 py-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                            <div className="min-w-0 flex-1">
                                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isComboboxOpen}
                                            className="flex h-10 min-h-10 w-full items-center justify-between gap-3 py-0 font-normal text-left"
                                        >
                                            <span
                                                className="min-w-0 flex-1 truncate pr-2 text-left leading-normal"
                                                title={
                                                    selectedItemId
                                                        ? items.find(m => m.id === selectedItemId)?.name
                                                        : undefined
                                                }
                                            >
                                                {selectedItemId
                                                    ? items.find(m => m.id === selectedItemId)?.name
                                                    : "Search & select item..."}
                                            </span>
                                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="pointer-events-auto z-[100] max-h-[min(50vh,380px)] w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-trigger-width)] overflow-hidden p-0 shadow-md"
                                        align="start"
                                        sideOffset={6}
                                    >
                                        <Command className="w-full">
                                            <CommandInputBorderless placeholder="Search item..." />
                                            <CommandList className="max-h-[min(50vh,300px)] overflow-y-auto">
                                                <CommandEmpty>No item found.</CommandEmpty>
                                                <CommandGroup>
                                                    {items.map((m) => {
                                                        const isAdded = vendorItems.some(vi => vi.item_id === m.id);
                                                        return (
                                                            <CommandItem
                                                                key={m.id}
                                                                value={m.name}
                                                                onSelect={() => {
                                                                    setSelectedItemId(m.id);
                                                                    setIsComboboxOpen(false);
                                                                }}
                                                                disabled={isAdded}
                                                                className={cn(
                                                                    "items-start gap-2.5 px-3.5 py-4",
                                                                    isAdded && "opacity-50"
                                                                )}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mt-1 h-4 w-4 shrink-0",
                                                                        selectedItemId === m.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-0.5">
                                                                    <span className="text-sm font-medium leading-snug break-words whitespace-normal pr-2">
                                                                        {m.name}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-mono break-all pr-2">
                                                                        {m.code}
                                                                    </span>
                                                                </div>
                                                                {isAdded && (
                                                                    <span className="ml-2 shrink-0 self-start pt-0.5 pr-1 text-[10px] italic text-muted-foreground">
                                                                        Already mapped
                                                                    </span>
                                                                )}
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {canEdit(permissionModule) && (
                                <Button
                                    onClick={() => {
                                        if (!selectedItemId) return;
                                        if (vendorItems.some(vi => vi.item_id === selectedItemId)) return;
                                        setVendorItems([...vendorItems, { item_id: selectedItemId, cost_per_unit: 0, delivery_time_days: 1 }]);
                                        setSelectedItemId(null);
                                    }}
                                    disabled={!selectedItemId}
                                    className="h-10 w-full shrink-0 px-6 md:w-auto"
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                            )}
                        </div>

                        <div
                            className={cn(
                                "rounded-md border overflow-x-auto",
                                vendorItems.length > 4
                                    ? "max-h-[min(50vh,420px)] overflow-y-auto"
                                    : ""
                            )}
                        >
                            <Table className="min-w-[540px] w-full">
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="h-12 min-w-[220px] text-xs">Item Name</TableHead>
                                        <TableHead className="h-12 w-[140px] min-w-[120px] whitespace-nowrap text-xs">Cost/Unit</TableHead>
                                        <TableHead className="h-12 w-[140px] min-w-[120px] whitespace-nowrap text-xs">Lead Time (Days)</TableHead>
                                        <TableHead className="h-12 w-[52px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendorItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-xs italic">
                                                No items mapped to this vendor.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        vendorItems.map((vi) => {
                                            const item = items.find(m => m.id === vi.item_id);
                                            const displayName = item?.name || vi.item_name || "Unknown Item";
                                            const displayCode = item?.code || vi.item_code;
                                            return (
                                                <TableRow key={vi.item_id}>
                                                    <TableCell className="min-w-[220px] py-5 align-top">
                                                        <div className="flex min-w-0 flex-col gap-1">
                                                            <span
                                                                className="text-sm font-medium leading-snug break-words"
                                                                title={displayName}
                                                            >
                                                                {displayName}
                                                            </span>
                                                            {displayCode && (
                                                                <span className="text-[10px] text-muted-foreground font-mono break-all">
                                                                    {displayCode}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-5 align-middle">
                                                        <Input
                                                            type="number"
                                                            value={vi.cost_per_unit}
                                                            onChange={(e) => setVendorItems(prev => prev.map(v => v.item_id === vi.item_id ? { ...v, cost_per_unit: parseFloat(e.target.value) || 0 } : v))}
                                                            className="h-11 w-full min-w-[100px] text-sm"
                                                            disabled={!canEdit(permissionModule)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-5 align-middle">
                                                        <Input
                                                            type="number"
                                                            value={vi.delivery_time_days}
                                                            onChange={(e) => setVendorItems(prev => prev.map(v => v.item_id === vi.item_id ? { ...v, delivery_time_days: parseInt(e.target.value) || 0 } : v))}
                                                            className="h-11 w-full min-w-[100px] text-sm"
                                                            disabled={!canEdit(permissionModule)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-5 align-middle pr-2">
                                                        {canEdit(permissionModule) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                                                                onClick={() => setVendorItems(prev => prev.filter(v => v.item_id !== vi.item_id))}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    </div>

                    <DialogFooter className="gap-3 border-t px-6 pb-6 pt-7">
                        <Button
                            variant="outline"
                            onClick={() => handleItemDialogOpenChange(false)}
                            disabled={isVendorItemsLoading}
                        >
                            Cancel
                        </Button>
                        {canEdit(permissionModule) && (
                            <Button
                                onClick={handleSaveVendorItems}
                                disabled={vendorItems.length === 0 || isVendorItemsLoading}
                            >
                                Save Mapping
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this vendor? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setVendorToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
