import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Trash2, X, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
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
import { cn } from "@/lib/utils";
import { mockStates, mockCities } from "@/lib/masterMockData";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { customersApi, commonApi, hrCommonApi } from "@/lib/api";
import { useCommonStore, useCommonActions } from "@/store/commonStore";

// --- Types & Interfaces ---

interface Address {
  id: number;
  address_line: string;
  country: string;
  state: string;
  city: string;
  pincode?: string;
  country_id?: number;
  state_id?: number;
  city_id?: number;
  address_type_id?: number;
  customer_address_id?: number;
}

interface CustomerDocument {
  id: number;
  name: string;
  file_name?: string;
  file?: File | null;
}

interface Customer {
  id: number;
  code: string;
  name: string;
  status: "Active" | "Inactive";
  contact_person: string;
  mobile: string;
  email?: string;
  phone?: string;
  city?: string;
  billing_address: Address;
  shipping_addresses: Address[];
  documents: CustomerDocument[];
  tax_reg_no?: string;
  payment_terms: string;
  payment_terms_id?: number;
  currency_id?: number;
  notes?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

// --- Mock Data ---

const initialCustomers: Customer[] = Array.from({ length: 5 }).map((_, index) => ({
  id: index + 1,
  code: `C${(index + 1).toString().padStart(3, '0')}`,
  name: index % 2 === 0 ? `Customer ${index + 1} Ltd` : `Enterprise ${index + 1} Corp`,
  status: index % 10 === 0 ? "Inactive" : "Active",
  contact_person: index % 2 === 0 ? `Alice ${index + 1}` : `Bob ${index + 1}`,
  mobile: `98765${(index + 10000).toString().slice(-5)}`,
  email: `customer${index + 1}@example.com`,
  billing_address: {
    id: index + 1,
    address_line: `${100 + index} Industrial Area`,
    country: "India",
    state: "Gujarat",
    city: "Ahmedabad",
    pincode: "380001"
  },
  shipping_addresses: [
    {
      id: index + 100,
      address_line: `${500 + index} Warehouse St`,
      country: "India",
      state: "Maharashtra",
      city: "Mumbai",
      pincode: "400001"
    }
  ],
  documents: [],
  tax_reg_no: `GSTIN${index + 10000}`,
  payment_terms: index % 3 === 0 ? "Net 30" : "Net 15",
  currency_id: 1,
  created_at: "2024-01-01",
  created_by: "Admin"
}));

const StatusBadge = ({ status }: { status: "Active" | "Inactive" }) => {
  return (
    <Badge variant={status === "Active" ? "default" : "secondary"}>
      {status}
    </Badge>
  );
};

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

export default function Customers() {
  const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
  const permissionModule = "GENERAL/CUSTOMERS";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState<string>("All");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
  const [isFormDialogPrepLoading, setIsFormDialogPrepLoading] = useState(false);
  const openingEditIdRef = useRef<number | null>(null);

  // Dropdown Data
  const countries = useCommonStore(state => state.countries || []);
  const { setCommonData } = useCommonActions();
  const [billingStates, setBillingStates] = useState<any[]>([]);
  const [billingCities, setBillingCities] = useState<any[]>([]);
  const [shippingAddressDropdowns, setShippingAddressDropdowns] = useState<Record<number, { states: any[], cities: any[] }>>({});
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  // React Query: Fetch customers list
  const { data: customersData, isLoading: isListLoading } = useQuery({
    queryKey: ['customers', currentPage, itemsPerPage, searchTerm, filterStatus],
    queryFn: () => customersApi.getList({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm,
      status: filterStatus === "All" ? undefined : (filterStatus === "Active" ? 1 : 0)
    }),
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  const customers = React.useMemo(() => {
    if (!customersData?.isSuccessful) return [];
    const records = Array.isArray(customersData.data?.records) ? customersData.data.records : [];
    return records.map((c: any) => ({
      ...c,
      contact_person: c.contact_person_name || c.contact_person || "-",
      status: c.status ? "Active" : "Inactive"
    }));
  }, [customersData]);

  const totalCustomers = customersData?.data?.pagination?.totalCount || 0;

  // React Query: Create customer mutation
  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: (res) => {
      if (res.isSuccessful) {
        toast({ 
          ...crudSuccessToast, 
          title: "Created", 
          description: "Customer created successfully" 
        });
        setIsDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else {
        toast({ variant: "destructive", title: "Error", description: res.message || "Failed to create customer" });
      }
    },
    onError: (error: any) => {
      console.error("Create error:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create customer" });
    }
  });

  // React Query: Update customer mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => customersApi.update(id, data),
    onSuccess: (res) => {
      if (res.isSuccessful) {
        toast({ ...crudSuccessToast, title: "Updated", description: res.message || "Customer updated successfully" });
        setIsDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else {
        toast({ variant: "destructive", title: "Error", description: res.message || "Failed to update customer" });
      }
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update customer" });
    }
  });

  // React Query: Delete customer mutation
  const deleteMutation = useMutation({
    mutationFn: customersApi.delete,
    onSuccess: (res) => {
      if (res.isSuccessful) {
        toast({ ...crudSuccessToast, title: "Deleted", description: "Customer deleted successfully." });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setIsDeleteDialogOpen(false);
        setIsDialogOpen(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: res.message || "Failed to delete customer" });
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete customer" });
    }
  });

  const fetchCountries = async () => {
    try {
      // console.log("Fetching countries from API...");
      const res = await hrCommonApi.getCountries();
      if (res.isSuccessful && res.data?.records) {
        setCommonData({ countries: res.data.records });
      }
    } catch (error) {
      console.error("Error fetching countries:", error);
    }
  };

  const fetchPaymentTerms = async () => {
    try {
      // console.log("Fetching payment terms from API...");
      const res = await commonApi.getPaymentTerms(1);
      if (res.isSuccessful) {
        setPaymentTerms(res.data?.records || []);
      }
    } catch (error) {
      console.error("Error fetching payment terms:", error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      // console.log("Fetching currencies from API...");
      const res = await commonApi.getCurrencies(1);
      if (res.isSuccessful) {
        const currencyData = res.data?.records || [];
        // console.log("Currency data:", currencyData);
        setCurrencies(currencyData);
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchStates = async (countryId: number, setFn: (data: any[]) => void) => {
    try {
      const res = await hrCommonApi.getStates(countryId);
      if (res.isSuccessful) {
        setFn(res.data?.records || []);
      }
    } catch (error) {
      console.error("Error fetching states:", error);
    }
  };

  const fetchCities = async (stateId: number, countryId: number, setFn: (data: any[]) => void) => {
    try {
      const res = await hrCommonApi.getCities(stateId, countryId);
      if (res.isSuccessful) {
        setFn(res.data?.records || []);
      }
    } catch (error) {
      console.error("Error fetching cities:", error);
    }
  };

  useEffect(() => {
    // Fetch countries every time the component mounts (every visit to customer module)
    // console.log("Customer module mounted - fetching dropdown data...");
    fetchCountries();
  }, []);

  const totalPages = Math.ceil(totalCustomers / itemsPerPage);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setIsFormDetailLoading(false);
      setIsFormDialogPrepLoading(false);
      openingEditIdRef.current = null;
      setEditingId(null);
    }
  };

  const handleAddClick = async () => {
    setEditingId(null);
    setValidationErrors({});
    setIsDialogOpen(true);
    setIsFormDialogPrepLoading(true);
    try {
      await fetchCountries();
      await fetchPaymentTerms();
      await fetchCurrencies();
      setFormData({
        status: "Active",
        payment_terms_id: undefined,
        currency_id: undefined,
        billing_address: { id: Date.now(), address_line: "", country: "", state: "", city: "", country_id: undefined, state_id: undefined, city_id: undefined },
        shipping_addresses: [{ id: Date.now() + 1, address_line: "", country: "", state: "", city: "", country_id: undefined, state_id: undefined, city_id: undefined }],
        documents: []
      });
      setBillingStates([]);
      setBillingCities([]);
      setShippingAddressDropdowns({});
    } finally {
      setIsFormDialogPrepLoading(false);
    }
  };

  const handleEditClick = async (customer: Customer) => {
    if (openingEditIdRef.current !== null) return;
    openingEditIdRef.current = customer.id;
    setEditingId(customer.id);
    setValidationErrors({});
    setIsDialogOpen(true);
    setIsFormDetailLoading(true);
    try {
      await fetchCountries();
      await fetchPaymentTerms();
      await fetchCurrencies();
      const res = await customersApi.getById(customer.id);
      if (res.isSuccessful) {
        const fullData = res.data;
        
        // Map backend response to frontend format
        const mappedData = {
          ...fullData,
          status: fullData.status ? "Active" : "Inactive",
          
          // Map tax_registration_no from backend to tax_reg_no for frontend
          tax_reg_no: fullData.tax_registration_no || "",
          
          // Map additional_notes from backend to notes for frontend
          notes: fullData.additional_notes || "",
          
          // Extract contact info - backend might return as flat fields OR as customer_contacts array
          contact_person: fullData.contact_person_name || fullData.customer_contacts?.[0]?.contact_person_name || "",
          mobile: fullData.mobile_number || fullData.customer_contacts?.[0]?.mobile_number || "",
          email: fullData.email || fullData.customer_contacts?.[0]?.email || "",
          
          // Extract billing address from customer_addresses array (address_type_id = 1)
          billing_address: fullData.customer_addresses?.find((addr: any) => addr.address_type_id === 1) ? 
            {
              ...fullData.customer_addresses.find((addr: any) => addr.address_type_id === 1),
              id: fullData.customer_addresses.find((addr: any) => addr.address_type_id === 1)?.id || Date.now(),
              customer_address_id: fullData.customer_addresses.find((addr: any) => addr.address_type_id === 1)?.id
            } : 
            { id: Date.now(), address_line: "", country: "", state: "", city: "", country_id: undefined, state_id: undefined, city_id: undefined },
          
          // Extract shipping addresses from customer_addresses array (address_type_id = 2)
          shipping_addresses: fullData.customer_addresses?.filter((addr: any) => addr.address_type_id === 2).map((addr: any) => ({
            ...addr,
            id: addr.id,
            customer_address_id: addr.id
          })) || 
            [{ id: Date.now() + 1, address_line: "", country: "", state: "", city: "", country_id: undefined, state_id: undefined, city_id: undefined }]
        };
        
        // Ensure we have at least one shipping address
        if (!mappedData.shipping_addresses || mappedData.shipping_addresses.length === 0) {
          mappedData.shipping_addresses = [{ id: Date.now(), address_line: "", country: "India", state: "", city: "", country_id: undefined, state_id: undefined, city_id: undefined }];
        }
        
        // Ensure billing address exists
        if (!mappedData.billing_address) {
          mappedData.billing_address = { id: Date.now() + 1, address_line: "", country: "India", state: "", city: "", country_id: undefined, state_id: undefined, city_id: undefined };
        }
        
        console.log("=== EDIT CUSTOMER DATA LOADED ===");
        console.log("Full data from API:", fullData);
        console.log("Mapped customer data for edit:", mappedData);
        console.log("Billing address:", {
          id: mappedData.billing_address?.id,
          customer_address_id: mappedData.billing_address?.customer_address_id,
          city_id: mappedData.billing_address?.city_id,
          city: mappedData.billing_address?.city,
          state_id: mappedData.billing_address?.state_id,
          country_id: mappedData.billing_address?.country_id
        });
        console.log("Shipping addresses:", mappedData.shipping_addresses?.map((a: any) => ({
          id: a.id,
          customer_address_id: a.customer_address_id,
          city_id: a.city_id,
          city: a.city,
          state_id: a.state_id,
          country_id: a.country_id
        })));
        console.log("================================");
        
        // Initial fetch for billing address dropdowns
        if (mappedData.billing_address.country_id) {
          console.log("Fetching states for billing address country_id:", mappedData.billing_address.country_id);
          fetchStates(mappedData.billing_address.country_id, setBillingStates);
          if (mappedData.billing_address.state_id) {
            console.log("Fetching cities for billing address state_id:", mappedData.billing_address.state_id);
            fetchCities(mappedData.billing_address.state_id, mappedData.billing_address.country_id, setBillingCities);
          }
        }
        
        // Initial fetch for shipping address dropdowns
        console.log("Initializing shipping address dropdowns...");
        mappedData.shipping_addresses.forEach((addr: any) => {
          console.log("Processing shipping address:", { id: addr.id, country_id: addr.country_id, state_id: addr.state_id, city_id: addr.city_id });
          if (addr.country_id) {
            fetchStates(addr.country_id, (states) => {
              console.log(`Fetched ${states.length} states for shipping address ${addr.id}`);
              setShippingAddressDropdowns(prev => ({ ...prev, [addr.id]: { ...prev[addr.id], states } }));
            });
            if (addr.state_id) {
              fetchCities(addr.state_id, addr.country_id, (cities) => {
                console.log(`Fetched ${cities.length} cities for shipping address ${addr.id}`);
                setShippingAddressDropdowns(prev => ({ ...prev, [addr.id]: { ...prev[addr.id], cities } }));
              });
            }
          }
        });

        setFormData(mappedData);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Failed to load customer details",
        });
        handleDialogOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error fetching customer details:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load customer details" });
      handleDialogOpenChange(false);
    } finally {
      setIsFormDetailLoading(false);
      openingEditIdRef.current = null;
    }
  };

  const handleDeleteClick = (id: number) => {
    setCustomerToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (customerToDelete === null) return;
    deleteMutation.mutate(customerToDelete);
    setCustomerToDelete(null);
  };

  // Check if all required fields are filled
  const isFormValid = () => {
    return !!(
      formData.code?.trim() &&
      formData.code.trim().length >= 2 &&
      formData.name?.trim() &&
      formData.name.trim().length >= 2 &&
      formData.contact_person?.trim() &&
      formData.mobile?.trim() &&
      formData.mobile.length === 10 &&
      (!formData.email || EMAIL_REGEX.test(formData.email)) &&
      formData.billing_address?.address_line?.trim() &&
      formData.billing_address?.country_id &&
      formData.billing_address?.state_id &&
      formData.billing_address?.city_id
    );
  };

  const handleSave = async () => {
    // Clear previous validation errors
    setValidationErrors({});
    
    // Validate required fields
    const errors: Record<string, string> = {};
    
    if (!formData.code || formData.code.trim().length === 0) {
      errors.code = "Customer code is required";
    } else if (formData.code.trim().length < 2) {
      errors.code = "Minimum 2 characters required";
    }
    
    if (!formData.name || formData.name.trim().length === 0) {
      errors.name = "Customer name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Minimum 2 characters required";
    }
    
    if (!formData.status) {
      errors.status = "Status is required";
    }
    
    if (!formData.contact_person || formData.contact_person.trim().length === 0) {
      errors.contact_person = "Contact person is required";
    }
    
    if (!formData.mobile || formData.mobile.trim().length === 0) {
      errors.mobile = "Mobile number is required";
    } else if (!PHONE_REGEX.test(formData.mobile)) {
      errors.mobile = "Mobile number must be a 10-digit number";
    }
    
    if (formData.email && !EMAIL_REGEX.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    // Validate billing address
    if (!formData.billing_address?.address_line || formData.billing_address.address_line.trim().length === 0) {
      errors.billing_address_line = "Billing address line is required";
    }
    
    if (!formData.billing_address?.country_id) {
      errors.billing_country = "Billing country is required";
    }
    
    if (!formData.billing_address?.state_id) {
      errors.billing_state = "Billing state is required";
    }
    
    if (!formData.billing_address?.city_id) {
      errors.billing_city = "Billing city is required";
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

    // Build proper payload structure for backend
    // Backend expects FLAT contact fields (not nested array) based on Postman test
    const payload: any = {
      code: formData.code,
      name: formData.name,
      status: formData.status === "Active" ? 1 : 0,
      tax_registration_no: formData.tax_reg_no || null,
      payment_terms_id: formData.payment_terms_id || null,
      currency_id: formData.currency_id,
      additional_notes: formData.notes || null,
      
      // Contact fields as FLAT properties (not nested in array)
      contact_person_name: formData.contact_person,
      mobile_number: formData.mobile,
      email: formData.email || null,
    };

    // For UPDATE: separate addresses into update/add/delete
    if (editingId) {
      const updateAddresses = [];
      const addAddresses = [];
      
      // Process billing address
      if (formData.billing_address && formData.billing_address.address_line) {
        const billingAddr: any = {
          address_type_id: 1, // 1 = billing address
          address_line: formData.billing_address.address_line,
          country_id: formData.billing_address.country_id || null,
          state_id: formData.billing_address.state_id || null,
          city_id: formData.billing_address.city_id || null,
          pincode: formData.billing_address.pincode || null
        };
        
        // If has customer_address_id, it's an update; otherwise it's new
        if (formData.billing_address.customer_address_id) {
          billingAddr.customer_address_id = formData.billing_address.customer_address_id;
          updateAddresses.push(billingAddr);
        } else {
          addAddresses.push(billingAddr);
        }
      }

      // Process shipping addresses
      if (formData.shipping_addresses && formData.shipping_addresses.length > 0) {
        formData.shipping_addresses.forEach(addr => {
          if (addr.address_line) {
            const shippingAddr: any = {
              address_type_id: 2, // 2 = shipping address
              address_line: addr.address_line,
              country_id: addr.country_id || null,
              state_id: addr.state_id || null,
              city_id: addr.city_id || null,
              pincode: addr.pincode || null
            };
            
            // If has customer_address_id, it's an update; otherwise it's new
            if (addr.customer_address_id) {
              shippingAddr.customer_address_id = addr.customer_address_id;
              updateAddresses.push(shippingAddr);
            } else {
              addAddresses.push(shippingAddr);
            }
          }
        });
      }

      // Add update_customer_address if there are addresses to update
      if (updateAddresses.length > 0) {
        payload.update_customer_address = {
          addresses: updateAddresses
        };
      }

      // Add add_customer_address if there are new addresses
      if (addAddresses.length > 0) {
        payload.add_customer_address = {
          addresses: addAddresses
        };
      }
    } else {
      // For CREATE: use simple customer_addresses array
      const addresses = [];
      
      // Add billing address with address_type_id
      if (formData.billing_address && formData.billing_address.address_line) {
        const billingAddr: any = {
          address_type_id: 1, // 1 = billing address
          address_line: formData.billing_address.address_line,
          country_id: formData.billing_address.country_id || null,
          state_id: formData.billing_address.state_id || null,
          city_id: formData.billing_address.city_id || null,
          pincode: formData.billing_address.pincode || null
        };
        addresses.push(billingAddr);
      }

      // Add shipping addresses with address_type_id
      if (formData.shipping_addresses && formData.shipping_addresses.length > 0) {
        formData.shipping_addresses.forEach(addr => {
          if (addr.address_line) {
            const shippingAddr: any = {
              address_type_id: 2, // 2 = shipping address
              address_line: addr.address_line,
              country_id: addr.country_id || null,
              state_id: addr.state_id || null,
              city_id: addr.city_id || null,
              pincode: addr.pincode || null
            };
            addresses.push(shippingAddr);
          }
        });
      }

      payload.customer_addresses = addresses;
    }

    console.log("=== PAYLOAD DEBUG ===");
    console.log("Full payload being sent:", JSON.stringify(payload, null, 2));
    console.log("Billing address from formData:", formData.billing_address);
    console.log("Shipping addresses from formData:", formData.shipping_addresses);
    console.log("Is editing:", !!editingId);
    if (editingId) {
      console.log("Update addresses:", payload.update_customer_address);
      console.log("Add addresses:", payload.add_customer_address);
    } else {
      console.log("Customer addresses:", payload.customer_addresses);
    }
    console.log("===================");

    // Use React Query mutations
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleBillingAddressChange = (field: keyof Address | 'country_id' | 'state_id' | 'city_id', value: any) => {
    setFormData(prev => {
      const newAddress = { ...prev.billing_address!, [field]: value };
      
      // Cascading logic
      if (field === 'country_id') {
        newAddress.state_id = undefined;
        newAddress.state = "";
        newAddress.city_id = undefined;
        newAddress.city = "";
        setBillingStates([]);
        setBillingCities([]);
        if (value) fetchStates(value, setBillingStates);
      } else if (field === 'state_id') {
        newAddress.city_id = undefined;
        newAddress.city = "";
        setBillingCities([]);
        if (value && prev.billing_address?.country_id) {
          fetchCities(value, prev.billing_address.country_id, setBillingCities);
        }
      }
      
      return { ...prev, billing_address: newAddress };
    });
  };

  const handleShippingAddressChange = (id: number, field: keyof Address | 'country_id' | 'state_id' | 'city_id', value: any) => {
    console.log(`handleShippingAddressChange called: id=${id}, field=${field}, value=${value}`);
    
    setFormData(prev => {
      const newShipping = prev.shipping_addresses!.map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, [field]: value };
        
        if (field === 'country_id') {
          console.log(`Shipping address ${id}: Country changed to ${value}, clearing state and city`);
          updated.state_id = undefined;
          updated.state = "";
          updated.city_id = undefined;
          updated.city = "";
          setShippingAddressDropdowns(prevD => ({ ...prevD, [id]: { states: [], cities: [] } }));
          if (value) {
            console.log(`Fetching states for country ${value}`);
            fetchStates(value, (states) => {
              console.log(`Received ${states.length} states for shipping address ${id}`);
              setShippingAddressDropdowns(prevD => ({ 
                ...prevD, 
                [id]: { 
                  states, 
                  cities: prevD[id]?.cities || [] 
                } 
              }));
            });
          }
        } else if (field === 'state_id') {
          console.log(`Shipping address ${id}: State changed to ${value}, clearing city`);
          updated.city_id = undefined;
          updated.city = "";
          setShippingAddressDropdowns(prevD => ({ 
            ...prevD, 
            [id]: { 
              states: prevD[id]?.states || [], 
              cities: [] 
            } 
          }));
          if (value && updated.country_id) {
            console.log(`Fetching cities for state ${value}, country ${updated.country_id}`);
            fetchCities(value, updated.country_id, (cities) => {
              console.log(`Received ${cities.length} cities for shipping address ${id}`);
              setShippingAddressDropdowns(prevD => ({ 
                ...prevD, 
                [id]: { 
                  states: prevD[id]?.states || [], 
                  cities 
                } 
              }));
            });
          }
        } else if (field === 'city_id') {
          console.log(`Shipping address ${id}: City changed to ${value}`);
        }
        return updated;
      });
      console.log("Updated shipping addresses:", newShipping);
      return { ...prev, shipping_addresses: newShipping };
    });
  };

  const handleAddShippingAddress = () => {
    setFormData(prev => ({
      ...prev,
      shipping_addresses: [...(prev.shipping_addresses || []), { id: Date.now(), address_line: "", country: "", state: "", city: "", country_id: undefined, state_id: undefined, city_id: undefined }]
    }));
  };

  const handleRemoveShippingAddress = (id: number) => {
    setFormData(prev => ({
      ...prev,
      shipping_addresses: prev.shipping_addresses!.filter(a => a.id !== id)
    }));
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Customers Master</h1>
        <p className="text-muted-foreground text-sm">Manage your customers, their locations, and billing details.</p>
      </div>

      <AppListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search by code, name, contact or city..."
        }}
        filters={[
          {
            type: 'select',
            label: 'Status',
            value: filterStatus,
            options: ["All", "Active", "Inactive"],
            onChange: setFilterStatus,
            searchable: true
          }
        ]}
        actions={[
          ...(canCreate(permissionModule) ? [{
            label: 'Add New Customer',
            icon: <Plus className="h-4 w-4 mr-2" />,
            onClick: handleAddClick,
            variant: 'default' as const
          }] : [])
        ]}
      />

      <Card>
        <CardContent className="pt-6 relative">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isListLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer: Customer) => (
                    <TableRow key={customer.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-sm font-medium">{customer.code}</TableCell>
                      <TableCell className="font-medium text-sm">{customer.name}</TableCell>
                      <TableCell className="text-sm">{customer.contact_person}</TableCell>
                      <TableCell className="text-sm">{customer.mobile}</TableCell>
                      <TableCell className="text-sm">{customer.city || customer.billing_address?.city || "-"}</TableCell>
                      <TableCell>
                        <StatusBadge status={customer.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <TableActionButtons
                          onEdit={canEdit(permissionModule) ? () => { void handleEditClick(customer); } : undefined}
                          onDelete={canDelete(permissionModule) ? () => handleDeleteClick(customer.id) : undefined}
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
              totalItems={totalCustomers}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              options={[10, 15, 30, 50]}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent 
          className="!flex min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 grow-0 space-y-1 p-4 pb-1.5">
            <DialogTitle className="text-lg">{editingId ? "Edit Customer" : "Create New Customer"}</DialogTitle>
            <DialogDescription className="text-xs leading-snug">
              Enter customer details, contact information and locations.
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
            <SectionHeader title="Basic Info" />
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Customer Code *</Label>
                <Input
                  value={formData.code || ""}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setFormData({ ...formData, code: value });
                    // Real-time validation - show error immediately
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
                <Label className="text-xs font-semibold">Customer Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, name: value });
                    // Real-time validation - show error immediately
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
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status *</Label>
                <Select value={formData.status || ""} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className={cn("h-8 w-full", validationErrors.status && "border-red-500 focus-visible:ring-red-500")}>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors.status && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.status}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tax Reg No</Label>
                <Input
                  value={formData.tax_reg_no || ""}
                  onChange={(e) => setFormData({ ...formData, tax_reg_no: e.target.value })}
                  className="h-8 w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Terms</Label>
                <Select
                  value={formData.payment_terms_id?.toString() || ""}
                  onValueChange={(val) => setFormData({ ...formData, payment_terms_id: parseInt(val) })}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Select Payment Terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTerms.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id.toString()}>
                        {pt.payment_term_name || pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Currency</Label>
                <Select 
                  value={formData.currency_id?.toString() || ""} 
                  onValueChange={(val) => {
                    console.log("Currency selected:", val);
                    console.log("Current formData.currency_id:", formData.currency_id);
                    setFormData({ ...formData, currency_id: parseInt(val) });
                  }}
                >
                  <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Select Currency" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((curr) => {
                      const currValue = curr.id?.toString() || "";
                      const currLabel = curr.name || curr.currency_name || "Unknown Currency";
                      console.log("Currency option:", { id: curr.id, value: currValue, label: currLabel, raw: curr });
                      return (
                        <SelectItem key={curr.id} value={currValue}>
                          {currLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SectionHeader title="Primary Contact" />
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Contact Person *</Label>
                <Input
                  value={formData.contact_person || ""}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className={cn("h-8 w-full", validationErrors.contact_person && "border-red-500 focus-visible:ring-red-500")}
                />
                {validationErrors.contact_person && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.contact_person}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Mobile *</Label>
                <Input
                  value={formData.mobile || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow numbers
                    const numericValue = value.replace(/[^0-9]/g, '');
                    // Limit to 10 digits
                    const limitedValue = numericValue.slice(0, 10);
                    setFormData({ ...formData, mobile: limitedValue });
                    
                    // Real-time validation
                    if (limitedValue.length > 0 && limitedValue.length < 10) {
                      setValidationErrors({ ...validationErrors, mobile: "Mobile number must be 10 digits" });
                    } else {
                      setValidationErrors({ ...validationErrors, mobile: "" });
                    }
                  }}
                  className={cn("h-8 w-full", validationErrors.mobile && "border-red-500 focus-visible:ring-red-500")}
                  maxLength={10}
                />
                {validationErrors.mobile && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.mobile}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email</Label>
                <Input
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
            </div>

            <SectionHeader title="Billing Address" />
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address Line *</Label>
                  <Input
                    value={formData.billing_address?.address_line || ""}
                    onChange={(e) => handleBillingAddressChange("address_line", e.target.value)}
                    className={cn("h-8 w-full", validationErrors.billing_address_line && "border-red-500 focus-visible:ring-red-500")}
                  />
                  {validationErrors.billing_address_line && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.billing_address_line}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Country *</Label>
                  <SearchableSelect
                    options={countries.map((c: any) => ({ value: c.id.toString(), label: c.country_name }))}
                    value={formData.billing_address?.country_id?.toString()}
                    onChange={(val) => {
                        const countryId = parseInt(val);
                        const countryName = countries.find((c: any) => c.id === countryId)?.country_name || "";
                        setFormData(prev => ({
                          ...prev,
                          billing_address: {
                            ...prev.billing_address!,
                            country_id: countryId,
                            country: countryName,
                            state_id: undefined,
                            state: "",
                            city_id: undefined,
                            city: ""
                          }
                        }));
                        setBillingStates([]);
                        setBillingCities([]);
                        if (countryId) fetchStates(countryId, setBillingStates);
                    }}
                    placeholder="Select Country"
                    className={cn(validationErrors.billing_country && "border-red-500")}
                  />
                  {validationErrors.billing_country && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.billing_country}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">State *</Label>
                  <SearchableSelect
                    options={billingStates.map((s: any) => ({ value: s.id.toString(), label: s.state_name }))}
                    value={formData.billing_address?.state_id?.toString()}
                    onChange={(val) => {
                        const stateId = parseInt(val);
                        const stateName = billingStates.find((s: any) => s.id === stateId)?.state_name || "";
                        setFormData(prev => ({
                          ...prev,
                          billing_address: {
                            ...prev.billing_address!,
                            state_id: stateId,
                            state: stateName,
                            city_id: undefined,
                            city: ""
                          }
                        }));
                        setBillingCities([]);
                        if (stateId && formData.billing_address?.country_id) {
                          fetchCities(stateId, formData.billing_address.country_id, setBillingCities);
                        }
                    }}
                    placeholder="Select State"
                    disabled={!formData.billing_address?.country_id}
                    className={cn(validationErrors.billing_state && "border-red-500")}
                  />
                  {validationErrors.billing_state && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.billing_state}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">City *</Label>
                  <SearchableSelect
                    options={billingCities.map((c: any) => ({ value: c.id.toString(), label: c.city_name }))}
                    value={formData.billing_address?.city_id?.toString()}
                    onChange={(val) => {
                        const cityId = parseInt(val);
                        const cityName = billingCities.find((c: any) => c.id === cityId)?.city_name || "";
                        console.log("=== BILLING CITY CHANGE ===");
                        console.log("Selected city ID:", cityId);
                        console.log("Selected city name:", cityName);
                        console.log("Current billing address before update:", formData.billing_address);
                        setFormData(prev => {
                          const updated = {
                            ...prev,
                            billing_address: {
                              ...prev.billing_address!,
                              city_id: cityId,
                              city: cityName
                            }
                          };
                          console.log("Updated billing address:", updated.billing_address);
                          return updated;
                        });
                    }}
                    placeholder="Select City"
                    disabled={!formData.billing_address?.state_id}
                    className={cn(validationErrors.billing_city && "border-red-500")}
                  />
                  {validationErrors.billing_city && (
                    <p className="text-xs text-red-500 mt-1">{validationErrors.billing_city}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader title="Shipping Locations" />
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="h-7 shrink-0 border-dashed text-xs sm:mb-1"
                onClick={handleAddShippingAddress}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Shipping Location
              </Button>
            </div>

            <div className="space-y-3">
              {formData.shipping_addresses?.map((addr, idx) => (
                <div key={addr.id} className="relative rounded-md border bg-muted/20 p-3">
                  {formData.shipping_addresses!.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 absolute top-2 right-2 text-destructive"
                      onClick={() => handleRemoveShippingAddress(addr.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address Line {idx + 1} *</Label>
                      <Input
                        value={addr.address_line}
                        onChange={(e) => handleShippingAddressChange(addr.id, "address_line", e.target.value)}
                        className="h-8 w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Country *</Label>
                      <SearchableSelect
                        options={countries.map((c: any) => ({ value: c.id.toString(), label: c.country_name }))}
                        value={addr.country_id?.toString()}
                        onChange={(val) => {
                            const countryId = parseInt(val);
                            const countryName = countries.find((c: any) => c.id === countryId)?.country_name || "";
                            setFormData(prev => ({
                              ...prev,
                              shipping_addresses: prev.shipping_addresses!.map(a => 
                                a.id === addr.id 
                                  ? { ...a, country_id: countryId, country: countryName, state_id: undefined, state: "", city_id: undefined, city: "" }
                                  : a
                              )
                            }));
                            setShippingAddressDropdowns(prevD => ({ ...prevD, [addr.id]: { states: [], cities: [] } }));
                            if (countryId) {
                              fetchStates(countryId, (states) => {
                                setShippingAddressDropdowns(prevD => ({ 
                                  ...prevD, 
                                  [addr.id]: { 
                                    states, 
                                    cities: prevD[addr.id]?.cities || [] 
                                  } 
                                }));
                              });
                            }
                        }}
                        placeholder="Select Country"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">State *</Label>
                      <SearchableSelect
                        options={(shippingAddressDropdowns[addr.id]?.states || []).map((s: any) => ({ value: s.id.toString(), label: s.state_name }))}
                        value={addr.state_id?.toString()}
                        onChange={(val) => {
                            const stateId = parseInt(val);
                            const stateName = (shippingAddressDropdowns[addr.id]?.states || []).find((s: any) => s.id === stateId)?.state_name || "";
                            setFormData(prev => ({
                              ...prev,
                              shipping_addresses: prev.shipping_addresses!.map(a => 
                                a.id === addr.id 
                                  ? { ...a, state_id: stateId, state: stateName, city_id: undefined, city: "" }
                                  : a
                              )
                            }));
                            setShippingAddressDropdowns(prevD => ({ 
                              ...prevD, 
                              [addr.id]: { 
                                states: prevD[addr.id]?.states || [], 
                                cities: [] 
                              } 
                            }));
                            if (stateId && addr.country_id) {
                              fetchCities(stateId, addr.country_id, (cities) => {
                                setShippingAddressDropdowns(prevD => ({ 
                                  ...prevD, 
                                  [addr.id]: { 
                                    states: prevD[addr.id]?.states || [], 
                                    cities 
                                  } 
                                }));
                              });
                            }
                        }}
                        placeholder="Select State"
                        disabled={!addr.country_id}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">City *</Label>
                      <SearchableSelect
                        options={(shippingAddressDropdowns[addr.id]?.cities || []).map((c: any) => ({ value: c.id.toString(), label: c.city_name }))}
                        value={addr.city_id?.toString()}
                        onChange={(val) => {
                            const cityId = parseInt(val);
                            const cityName = (shippingAddressDropdowns[addr.id]?.cities || []).find((c: any) => c.id === cityId)?.city_name || "";
                            console.log("=== SHIPPING CITY CHANGE ===");
                            console.log("Address ID:", addr.id);
                            console.log("Selected city ID:", cityId);
                            console.log("Selected city name:", cityName);
                            console.log("Current address before update:", addr);
                            setFormData(prev => {
                              const updated = {
                                ...prev,
                                shipping_addresses: prev.shipping_addresses!.map(a => 
                                  a.id === addr.id 
                                    ? { ...a, city_id: cityId, city: cityName }
                                    : a
                                )
                              };
                              console.log("Updated shipping addresses:", updated.shipping_addresses);
                              return updated;
                            });
                        }}
                        placeholder="Select City"
                        disabled={!addr.state_id}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <SectionHeader title="Additional Notes" />
            <div className="space-y-1.5">
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any internal notes..."
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
                disabled={createMutation.isPending || updateMutation.isPending || isFormDetailLoading || isFormDialogPrepLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={createMutation.isPending || updateMutation.isPending || isFormDetailLoading || isFormDialogPrepLoading}
              >
                Cancel
              </Button>
              {((!editingId && canCreate(permissionModule)) || (editingId && canEdit(permissionModule))) && (
                <Button 
                  onClick={handleSave} 
                  className="bg-primary hover:bg-primary/90"
                  loading={createMutation.isPending || updateMutation.isPending}
                  disabled={!isFormValid() || isFormDetailLoading || isFormDialogPrepLoading}
                >
                  {editingId ? "Update Customer" : "Create Customer"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel>
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
