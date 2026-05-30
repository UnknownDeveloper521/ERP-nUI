import { useState, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { countriesApi, statesApi, commonApi, citiesApi } from "@/lib/api";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useLocation, useParams } from "wouter";
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
import { Plus, Search, Trash2, CalendarIcon, Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/store";
import { useHasPermission } from "@/hooks/usePermissions";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { 
    mockCountries, 
    mockStates, 
    mockCities, 
    BaseMasterItem as SharedBaseMasterItem 
} from "@/lib/masterMockData";

// --- Types & Interfaces ---

type MasterType =
    | "Country"
    | "State"
    | "City"
    | "UserRoles"
    | "LeavePolicy";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Country": "country",
    "State": "state",
    "City": "city",
    "UserRoles": "user-roles",
    "LeavePolicy": "leave-policy"
};

const MASTER_TYPES: MasterType[] = [
    "Country",
    "State",
    "City",
    "UserRoles",
    "LeavePolicy"
];

const MASTER_LABELS: Record<MasterType, string> = {
    "Country": "Country",
    "State": "State",
    "City": "City",
    "UserRoles": "User Roles",
    "LeavePolicy": "Leave Policy"
};

interface LeaveTypeDistribution {
    id: number;
    leave_type: string;
    allocated_days: number;
    carry_forward: boolean;
    negative_balance: boolean;
    max_per_request?: number;
}

interface LeavePolicy {
    id: number;
    policy_name: string;
    status: "Active" | "Inactive";
    annual_quota: number;
    monthly_quota?: number;
    allow_half_day: boolean;
    allow_carry_forward: boolean;
    max_carry_forward?: number;
    allow_negative_balance: boolean;
    max_negative_balance?: number;
    attachment_required: boolean;
    encashment_allowed: boolean;
    brought_forward_future?: number;
    fixed_holiday_count?: number;
    optional_holiday_count?: number;
    period_start_month?: number;
    period_end_month?: number;
    min_days_per_request: number;
    max_days_per_request?: number;
    distribution: LeaveTypeDistribution[];
    updated_at?: string;
    updated_by?: string;
}

type BaseMasterItem = SharedBaseMasterItem & {
    country_id?: number;
    state_id?: number;
};

const ErrorMessage = ({ field, errors }: { field: string; errors: Record<string, string> }) => {
    if (!errors[field]) return null;
    return <span className="text-xs text-red-500 font-medium mb-1 block">{errors[field]}</span>;
};

// --- Initial Data ---

// --- Default Data ---
const initialCountries: BaseMasterItem[] = mockCountries;
const initialStates: BaseMasterItem[] = mockStates;
const initialCities: BaseMasterItem[] = mockCities;

const initialUserRoles: BaseMasterItem[] = [
    { id: 1, code: "ADMIN", name: "Administrator", description: "Full system access", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "System" },
    { id: 2, code: "HR_MGR", name: "HR Manager", description: "Manage employees and leave", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "System" },
    { id: 3, code: "EMP", name: "Employee", description: "Standard employee access", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "System" },
];

const initialLeavePolicy: LeavePolicy = {
    id: 1,
    policy_name: "Standard Leave Policy",
    status: "Active",
    annual_quota: 20,
    monthly_quota: 1.5,
    allow_half_day: true,
    allow_carry_forward: true,
    max_carry_forward: 5,
    allow_negative_balance: false,
    attachment_required: true,
    encashment_allowed: false,
    brought_forward_future: 0,
    fixed_holiday_count: 10,
    optional_holiday_count: 2,
    period_start_month: 4,
    period_end_month: 3,
    min_days_per_request: 0.5,
    distribution: [
        { id: 1, leave_type: "Casual Leave", allocated_days: 10, carry_forward: false, negative_balance: false },
        { id: 2, leave_type: "Sick Leave", allocated_days: 10, carry_forward: true, negative_balance: false },
    ],
    updated_at: "2024-01-01",
    updated_by: "Admin"
};

// --- Main Component ---

export default function CoreMasters() {
    const { toast } = useToast();
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const [location, setLocation] = useLocation();
    const params = useParams();

    const universalKey = "Masters:Core";

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Country";
    };

    const selectedMaster = getValidMaster(params.type);
    const [activeTab, setActiveTab] = useState(MASTER_SLUGS[selectedMaster]);

    // Handle auto-redirect if the entire module is not authorized
    useEffect(() => {
        if (!isMenuVisible(universalKey)) {
            // If they don't have access to Core Masters at all, they shouldn't be here
            // But we already have ProtectedRoute. This is just an extra guard.
        }
    }, [isMenuVisible, setLocation]);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [masterData, setMasterData] = useState<{ [key in MasterType]?: BaseMasterItem[] }>({
        "Country": initialCountries,
        "State": initialStates,
        "City": initialCities,
        "UserRoles": initialUserRoles
    });

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
    const openingEditIdRef = useRef<number | null>(null);
    const [formData, setFormData] = useState<Partial<BaseMasterItem>>({});
    const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(initialLeavePolicy);
    const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});

    // --- Country API Integration ---
    const [countryPage, setCountryPage] = useState(1);

    const { data: countryApiData, isLoading: countryLoading, isError: countryError } = useQuery({
        queryKey: ["countries", countryPage, itemsPerPage, debouncedSearchTerm],
        queryFn: () => countriesApi.getList({ page: countryPage, limit: itemsPerPage, search: debouncedSearchTerm || undefined }),
        enabled: selectedMaster === "Country",
        staleTime: 0,
    });

    // Map API records to BaseMasterItem shape
    const countryApiRecords: BaseMasterItem[] = (countryApiData?.data?.records || []).map(r => ({
        id: r.id,
        name: r.country_name,
        code: r.country_code,
        status: r.status ? "Active" : "Inactive",
        created_at: r.created_at,
        updated_at: r.updated_at,
    }));

    const countryPagination = countryApiData?.data?.pagination;

    // --- Country Mutations ---
    const queryClient = useQueryClient();

    const createCountryMutation = useMutation({
        mutationFn: (data: { country_code: string; country_name: string; status: boolean }) =>
            countriesApi.create(data),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["countries"] });
                setIsDialogOpen(false);
                toast({ 
                    title: "Success", 
                    description: "Country created successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    const updateCountryMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { country_name: string; status: boolean } }) =>
            countriesApi.update(id, data),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["countries"] });
                setIsDialogOpen(false);
                toast({ 
                    title: "Success", 
                    description: "Country updated successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    const deleteCountryMutation = useMutation({
        mutationFn: (id: number) => countriesApi.delete(id),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["countries"] });
                toast({ 
                    title: "Deleted", 
                    description: "Country deleted successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
            setIsDeleteAlertOpen(false);
            setItemToDelete(null);
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setIsDeleteAlertOpen(false);
            setItemToDelete(null);
        },
    });

    // --- State API Integration ---
    const [statePage, setStatePage] = useState(1);

    const { data: stateApiData, isLoading: stateLoading, isError: stateError } = useQuery({
        queryKey: ["states", statePage, itemsPerPage, debouncedSearchTerm],
        queryFn: () => statesApi.getList({ page: statePage, limit: itemsPerPage, search: debouncedSearchTerm || undefined }),
        enabled: selectedMaster === "State",
        staleTime: 0,
    });


    const { data: allStatesDropdownData } = useQuery({
        queryKey: ["all-states-dropdown", selectedMaster],
        queryFn: () => commonApi.getStatesDropdown(), // This should return all states with country_id
        enabled: selectedMaster === "City",
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: "always",
    });

    // Handle different response structures from the API
    let allStatesDropdown: any[] = [];
    if (allStatesDropdownData?.data) {
        if (Array.isArray(allStatesDropdownData.data)) {
            // Direct array: { data: [...] }
            allStatesDropdown = allStatesDropdownData.data;
        } else if (allStatesDropdownData.data.records && Array.isArray(allStatesDropdownData.data.records)) {
            // Wrapped in records: { data: { records: [...] } }
            allStatesDropdown = allStatesDropdownData.data.records;
        }
    }

    const { data: allCountriesData, isLoading: allCountriesLoading } = useQuery({
        queryKey: ["all-countries-dropdown", selectedMaster],
        queryFn: () => commonApi.getCountriesDropdown(),
        enabled: selectedMaster === "State" || selectedMaster === "City" || isDialogOpen,
        staleTime: 0,
        gcTime: 0,
    });

    // Handle different response structures from the API
    let allCountries: any[] = [];
    if (allCountriesData?.data) {
        if (Array.isArray(allCountriesData.data)) {
            // Direct array: { data: [...] }
            allCountries = allCountriesData.data;
        } else if (allCountriesData.data.records && Array.isArray(allCountriesData.data.records)) {
            // Wrapped in records: { data: { records: [...] } }
            allCountries = allCountriesData.data.records;
        }
    }
    
    // Filter for active countries - handle different status formats
    const activeCountries = allCountries
        .filter((c: any) => {
            // Handle status as boolean, number, or string
            if (typeof c.status === 'boolean') return c.status === true;
            if (typeof c.status === 'number') return c.status === 1;
            if (typeof c.status === 'string') return c.status === '1' || c.status.toLowerCase() === 'true';
            // If status field doesn't exist, include the country
            return c.status !== false && c.status !== 0 && c.status !== '0';
        })
        .sort((a: any, b: any) => (a.country_name || '').localeCompare(b.country_name || ''));


    const stateApiRecords: BaseMasterItem[] = (stateApiData?.data?.records || []).map(r => ({
        id: r.id,
        name: r.state_name,
        code: r.state_code,
        country: (r as any).country_name || "",
        country_id: r.country_id,
        status: r.status ? "Active" : "Inactive",
        created_at: r.created_at,
        updated_at: r.updated_at,
    }));

    const statePagination = stateApiData?.data?.pagination;

    const createStateMutation = useMutation({
        mutationFn: (data: { country_id: number; state_code: string; state_name: string; status: boolean }) =>
            statesApi.create(data),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["states"] });
                setIsDialogOpen(false);
                toast({ 
                    title: "Success", 
                    description: "State created successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    const updateStateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { state_name: string; country_id?: number; status: boolean } }) =>
            statesApi.update(id, data),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["states"] });
                setIsDialogOpen(false);
                toast({ 
                    title: "Success", 
                    description: "State updated successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    const deleteStateMutation = useMutation({
        mutationFn: (id: number) => statesApi.delete(id),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["states"] });
                toast({ 
                    title: "Deleted", 
                    description: "State deleted successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
            setIsDeleteAlertOpen(false);
            setItemToDelete(null);
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setIsDeleteAlertOpen(false);
            setItemToDelete(null);
        },
    });

    // --- City API Integration ---
    const [cityPage, setCityPage] = useState(1);

    const { data: cityApiData, isLoading: cityLoading, isError: cityError } = useQuery({
        queryKey: ["cities", cityPage, itemsPerPage, debouncedSearchTerm],
        queryFn: () => citiesApi.getList({ page: cityPage, limit: itemsPerPage, search: debouncedSearchTerm || undefined }),
        enabled: selectedMaster === "City",
        staleTime: 0,
    });

    const cityApiRecords: BaseMasterItem[] = (cityApiData?.data?.records || []).map(r => {
        // Try to use data from API response first, otherwise lookup from dropdown arrays
        const stateObj = allStatesDropdown.find((s: any) => s.id == r.state_id);
        const countryId = (r as any).country_id || stateObj?.country_id;
        const countryObj = countryId ? allCountries.find((c: any) => c.id == countryId) : null;
        
        return {
            id: r.id,
            name: r.city_name,
            code: r.city_code,
            state_id: r.state_id,
            state: (r as any).state_name || stateObj?.state_name || "",
            country: (r as any).country_name || countryObj?.country_name || "",
            status: r.status ? "Active" : "Inactive",
            created_at: r.created_at,
            updated_at: r.updated_at,
        };
    });

    const cityPagination = cityApiData?.data?.pagination;

    const createCityMutation = useMutation({
        mutationFn: (data: { state_id: number; city_code: string; city_name: string; status: boolean }) =>
            citiesApi.create(data),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["cities"] });
                setIsDialogOpen(false);
                toast({ 
                    title: "Success", 
                    description: "City created successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    const updateCityMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { city_name: string; state_id?: number; status: boolean } }) =>
            citiesApi.update(id, data),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["cities"] });
                setIsDialogOpen(false);
                toast({ 
                    title: "Success", 
                    description: "City updated successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    const deleteCityMutation = useMutation({
        mutationFn: (id: number) => citiesApi.delete(id),
        onSuccess: (result) => {
            if (result.isSuccessful) {
                queryClient.invalidateQueries({ queryKey: ["cities"] });
                toast({ 
                    title: "Deleted", 
                    description: "City deleted successfully.",
                    variant: "success"
                });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
            setIsDeleteAlertOpen(false);
            setItemToDelete(null);
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
            setIsDeleteAlertOpen(false);
            setItemToDelete(null);
        },
    });

    const isSubmitting = useMemo(() => {
        if (selectedMaster === "Country") return createCountryMutation.isPending || updateCountryMutation.isPending;
        if (selectedMaster === "State") return createStateMutation.isPending || updateStateMutation.isPending;
        if (selectedMaster === "City") return createCityMutation.isPending || updateCityMutation.isPending;
        return false;
    }, [selectedMaster, createCountryMutation.isPending, updateCountryMutation.isPending, createStateMutation.isPending, updateStateMutation.isPending, createCityMutation.isPending, updateCityMutation.isPending]);

    const isDeleting = useMemo(() => {
        if (selectedMaster === "Country") return deleteCountryMutation.isPending;
        if (selectedMaster === "State") return deleteStateMutation.isPending;
        if (selectedMaster === "City") return deleteCityMutation.isPending;
        return false;
    }, [selectedMaster, deleteCountryMutation.isPending, deleteStateMutation.isPending, deleteCityMutation.isPending]);

    const isListLoading =
        selectedMaster === "Country"
            ? countryLoading
            : selectedMaster === "State"
              ? stateLoading
              : selectedMaster === "City"
                ? cityLoading
                : false;

    const { data: statesDropdownData } = useQuery({
        queryKey: ["states-dropdown", formData.country_id],
        queryFn: () => statesApi.getList({ limit: 1000, country_id: formData.country_id as number }),
        enabled: selectedMaster === "City" && !!formData.country_id && isDialogOpen,
        staleTime: 0,
    });

    // Filtered so that the creation Modal form only allows selecting active states
    const statesDropdown = (statesDropdownData?.data?.records || [])
        .filter(s => s.status)
        .sort((a, b) => (a.state_name || '').localeCompare(b.state_name || ''));

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setLocation(`/masters/core/${value}`);
        setSearchTerm("");
        setCurrentPage(1);
    };

    useEffect(() => {
        const newMaster = getValidMaster(params.type);
        const newSlug = MASTER_SLUGS[newMaster];
        if (newSlug !== activeTab) {
            setActiveTab(newSlug);
        }
        if (location === '/masters/core') {
            setLocation('/masters/core/country');
        }
    }, [params.type, location]);

    // Reset pagination when search changes
    useEffect(() => {
        setCountryPage(1);
        setStatePage(1);
        setCityPage(1);
        setCurrentPage(1);
    }, [debouncedSearchTerm]);

    // Reset pagination when items per page changes
    useEffect(() => {
        setCountryPage(1);
        setStatePage(1);
        setCityPage(1);
    }, [itemsPerPage]);

    const currentMasterList = (selectedMaster === "LeavePolicy" || selectedMaster === "Country" || selectedMaster === "State")
        ? []
        : (masterData[selectedMaster] || []);
    const filteredData = currentMasterList.filter(item =>
        Object.values(item).some(value =>
            String(value).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        )
    );

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, selectedMaster]);

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
            setEditingId(null);
        }
    };

    const handleAddClick = () => {
        if (openingEditIdRef.current !== null) return;
        setEditingId(null);
        setFormData({ status: "Active" });
        setIsFormDetailLoading(false);
        setIsDialogOpen(true);
    };

    const handleEditClick = async (item: BaseMasterItem) => {
        if (openingEditIdRef.current !== null) return;
        openingEditIdRef.current = item.id;
        setEditingId(item.id);
        setIsDialogOpen(true);
        setIsFormDetailLoading(true);

        try {
            if (selectedMaster === "Country") {
                const result = await countriesApi.getById(item.id);
                if (result.isSuccessful && result.data) {
                    setFormData({
                        id: result.data.id,
                        name: result.data.country_name,
                        code: result.data.country_code,
                        status: result.data.status ? "Active" : "Inactive",
                    });
                } else {
                    setFormData({ ...item });
                }
            } else if (selectedMaster === "State") {
                setFormData({ status: "Active" });
                const result = await statesApi.getById(item.id);
                if (result.isSuccessful && result.data) {
                    setFormData({
                        id: result.data.id,
                        name: result.data.state_name,
                        code: result.data.state_code,
                        country_id: result.data.country_id,
                        country: allCountries.find(c => c.id == result.data!.country_id)?.country_name || "",
                        status: result.data.status ? "Active" : "Inactive",
                    });
                } else {
                    setFormData({ ...item });
                }
            } else if (selectedMaster === "City") {
                setFormData({ status: "Active" });
                const result = await citiesApi.getById(item.id);
                if (result.isSuccessful && result.data) {
                    try {
                        const stateResult = await statesApi.getById(result.data.state_id);
                        const countryId = stateResult.isSuccessful ? stateResult.data?.country_id : undefined;
                        setFormData({
                            id: result.data.id,
                            name: result.data.city_name,
                            code: result.data.city_code,
                            state_id: result.data.state_id,
                            country_id: countryId,
                            status: result.data.status ? "Active" : "Inactive",
                        });
                    } catch {
                        setFormData({
                            id: result.data.id,
                            name: result.data.city_name,
                            code: result.data.city_code,
                            state_id: result.data.state_id,
                            status: result.data.status ? "Active" : "Inactive",
                        });
                    }
                } else {
                    setFormData({ ...item });
                }
            } else {
                setFormData({ ...item });
            }
        } catch {
            setFormData({ ...item });
        } finally {
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
        }
    };

    const handleDeleteClick = (id: number) => {
        setItemToDelete(id);
        setIsDeleteAlertOpen(true);
    };

    const confirmDelete = () => {
        if (itemToDelete === null) return;

        if (selectedMaster === "Country") {
            deleteCountryMutation.mutate(itemToDelete);
            return;
        }

        if (selectedMaster === "State") {
            deleteStateMutation.mutate(itemToDelete);
            return;
        }

        if (selectedMaster === "City") {
            deleteCityMutation.mutate(itemToDelete);
            return;
        }
        
        setMasterData(prev => ({
            ...prev,
            [selectedMaster]: prev[selectedMaster]?.filter(item => item.id !== itemToDelete)
        }));
        
        toast({ 
            title: "Deleted", 
            description: "Record deleted successfully.",
            variant: "success"
        });
        setIsDeleteAlertOpen(false);
        setItemToDelete(null);
    };

    const validateField = (field: keyof LeavePolicy, value: any): string => {
        if (field === "policy_name") {
            if (!value) return "Policy Name is required.";
            if (value.length > 50) return "Policy Name must be 50 characters or less.";
        }
        if (["annual_quota", "monthly_quota", "max_carry_forward", "max_negative_balance", "brought_forward_future", "fixed_holiday_count", "optional_holiday_count", "min_days_per_request", "max_days_per_request"].includes(field)) {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }
        if (field === "period_start_month" || field === "period_end_month") {
            if (value < 1 || value > 12) return "Must be between 1 and 12.";
        }
        return "";
    };

    const handlePolicyUpdate = (field: keyof LeavePolicy, value: any) => {
        setLeavePolicy(prev => ({ ...prev, [field]: value }));
        const error = validateField(field, value);
        setPolicyErrors(prev => {
            const newErrors = { ...prev };
            if (error) newErrors[field] = error;
            else delete newErrors[field];
            return newErrors;
        });
    };

    const handleDistributionUpdate = (id: number, field: string, value: any) => {
        setLeavePolicy(prev => ({
            ...prev,
            distribution: prev.distribution.map(d => d.id === id ? { ...d, [field]: value } : d)
        }));
        let error = "";
        if (field === "allocated_days" || field === "max_per_request") {
            if (value < 0) error = "Cannot be negative.";
            else if (value > 50) error = "Max limit is 50.";
        }
        setPolicyErrors(prev => {
            const newErrors = { ...prev };
            const errorKey = `dist_${id}_${field}`;
            if (error) newErrors[errorKey] = error;
            else delete newErrors[errorKey];
            return newErrors;
        });
    };

    const handleAddDistributionRow = () => {
        const newId = Math.max(...leavePolicy.distribution.map(d => d.id), 0) + 1;
        setLeavePolicy(prev => ({
            ...prev,
            distribution: [
                ...prev.distribution,
                { id: newId, leave_type: "", allocated_days: 0, carry_forward: prev.allow_carry_forward, negative_balance: prev.allow_negative_balance }
            ]
        }));
    };

    const handleRemoveDistributionRow = (id: number) => {
        setLeavePolicy(prev => ({
            ...prev,
            distribution: prev.distribution.filter(item => item.id !== id)
        }));
    };

    const handleSavePolicy = () => {
        if (!leavePolicy.policy_name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Policy Name is required." });
            return;
        }
        const totalAllocated = leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0);
        if (totalAllocated !== leavePolicy.annual_quota) {
            toast({ variant: "destructive", title: "Validation Error", description: `Total allocated days (${totalAllocated}) must match Annual Quota (${leavePolicy.annual_quota}).` });
            return;
        }
        const now = new Date().toISOString();
        setLeavePolicy(prev => ({ ...prev, updated_at: now, updated_by: "Admin" }));
        toast({ 
            title: "Success", 
            description: "Leave Policy saved successfully.",
            variant: "success"
        });
    };

    const handleSave = () => {
        if (!formData.status) {
            toast({ variant: "destructive", title: "Validation Error", description: "Status is required." });
            return;
        }
        if (!formData.name && selectedMaster !== "LeavePolicy") {
            toast({ variant: "destructive", title: "Validation Error", description: `Name is required.` });
            return;
        }
        // Check if name is only whitespace
        if (formData.name && formData.name.trim() === '' && selectedMaster !== "LeavePolicy") {
            toast({ variant: "destructive", title: "Validation Error", description: `Name cannot be only whitespace.` });
            return;
        }

        // Country create: call API
        if (selectedMaster === "Country" && !editingId) {
            // Auto-derive country_code from name (first 3 chars uppercased)
            const autoCode = (formData.name || "").replace(/\s+/g, "").substring(0, 3).toUpperCase();
            createCountryMutation.mutate({
                country_code: autoCode,
                country_name: formData.name!,
                status: formData.status === "Active",
            });
            return;
        }

        // Country update: call API
        if (selectedMaster === "Country" && editingId) {
            updateCountryMutation.mutate({
                id: editingId,
                data: {
                    country_name: formData.name!,
                    status: formData.status === "Active",
                },
            });
            return;
        }

        // State create: call API
        if (selectedMaster === "State" && !editingId) {
            if (!formData.country_id) {
                toast({ variant: "destructive", title: "Validation Error", description: "Country is required." });
                return;
            }
            const autoCode = (formData.name || "").replace(/\s+/g, "").substring(0, 3).toUpperCase();
            createStateMutation.mutate({
                country_id: formData.country_id as number,
                state_code: autoCode,
                state_name: formData.name!,
                status: formData.status === "Active",
            });
            return;
        }

        // State update: call API
        if (selectedMaster === "State" && editingId) {
            updateStateMutation.mutate({
                id: editingId,
                data: {
                    state_name: formData.name!,
                    country_id: formData.country_id as number,
                    status: formData.status === "Active",
                },
            });
            return;
        }

        // State: require country (fallback)
        if (selectedMaster === "State" && !formData.country_id && !formData.country) {
            toast({ variant: "destructive", title: "Validation Error", description: "Country is required." });
            return;
        }

        // City create: call API
        if (selectedMaster === "City" && !editingId) {
            if (!formData.country_id) {
                toast({ variant: "destructive", title: "Validation Error", description: "Country is required." });
                return;
            }
            if (!formData.state_id) {
                toast({ variant: "destructive", title: "Validation Error", description: "State is required." });
                return;
            }
            const autoCode = (formData.name || "").replace(/\s+/g, "").substring(0, 3).toUpperCase();
            createCityMutation.mutate({
                state_id: formData.state_id as number,
                city_code: autoCode,
                city_name: formData.name!,
                status: formData.status === "Active",
            });
            return;
        }

        // City update: call API
        if (selectedMaster === "City" && editingId) {
            updateCityMutation.mutate({
                id: editingId,
                data: {
                    city_name: formData.name!,
                    state_id: formData.state_id as number,
                    status: formData.status === "Active",
                },
            });
            return;
        }

        const now = new Date().toISOString();
        const user = "Admin User";
        setMasterData(prev => {
            const list = prev[selectedMaster] || [];
            if (editingId) {
                return {
                    ...prev,
                    [selectedMaster]: list.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now, updated_by: user } : item)
                };
            } else {
                const newId = Math.max(...list.map(d => d.id), 0) + 1;
                const newItem: BaseMasterItem = {
                    id: newId,
                    name: formData.name || "",
                    status: formData.status || "Active",
                    ...formData,
                    created_at: now,
                    created_by: user
                };
                return { ...prev, [selectedMaster]: [...list, newItem] };
            }
        });
        setIsDialogOpen(false);
        toast({ 
            title: "Success", 
            description: editingId ? "Record updated successfully" : "Record created successfully",
            variant: "success"
        });
    };

    const renderTableHeaders = () => {
        switch (selectedMaster) {
            case "Country": return <><TableHead className="w-[60%]">Country Name</TableHead><TableHead className="w-[25%]">Status</TableHead></>;
            case "State": return <><TableHead className="w-[40%]">State Name</TableHead><TableHead className="w-[30%]">Country</TableHead><TableHead className="w-[20%]">Status</TableHead></>;
            case "City": return <><TableHead className="w-[30%]">City Name</TableHead><TableHead className="w-[20%]">State</TableHead><TableHead className="w-[20%]">Country</TableHead><TableHead className="w-[15%]">Status</TableHead></>;
            case "LeavePolicy": return <><TableHead className="w-[40%]">Policy Name</TableHead><TableHead className="w-[30%]">Annual Quota</TableHead><TableHead className="w-[20%]">Status</TableHead></>;
            case "UserRoles": return <><TableHead className="w-[15%]">Code</TableHead><TableHead className="w-[25%]">Role Name</TableHead><TableHead className="w-[35%]">Description</TableHead><TableHead className="w-[15%]">Status</TableHead></>;
            default: return <><TableHead>Name</TableHead><TableHead>Status</TableHead></>;
        }
    };

    const renderTableRow = (item: BaseMasterItem) => {
        switch (selectedMaster) {
            case "Country": return <><TableCell className="font-medium">{item.name}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            case "State": return <><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.country || ""}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            case "City": return <><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.state || ""}</TableCell><TableCell>{item.country || ""}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            case "LeavePolicy":
                const policy = item as unknown as LeavePolicy;
                return <><TableCell className="font-medium">{policy.policy_name}</TableCell><TableCell>{policy.annual_quota} Days</TableCell><TableCell><StatusBadge status={policy.status} /></TableCell></>;
            case "UserRoles": return <><TableCell className="font-medium">{item.code}</TableCell><TableCell>{item.name}</TableCell><TableCell>{item.description}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            default: return <><TableCell className="font-medium">{item.name}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
        }
    };

    const renderLeavePolicyForm = () => {
        const totalAllocated = leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0);
        const isQuotaMatched = totalAllocated === leavePolicy.annual_quota;
        return (
            <div className="flex flex-col gap-6 h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Policy Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="policy-name">Policy Name <span className="text-red-500">*</span></Label>
                                <ErrorMessage field="policy_name" errors={policyErrors} />
                                <Input id="policy-name" value={leavePolicy.policy_name} maxLength={50} onChange={(e) => handlePolicyUpdate("policy_name", e.target.value)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="policy-status">Status</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{leavePolicy.status}</span>
                                    <Switch id="policy-status" checked={leavePolicy.status === "Active"} onCheckedChange={(checked) => handlePolicyUpdate("status", checked ? "Active" : "Inactive")} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="annual-quota">Annual Leave Quota <span className="text-red-500">*</span></Label>
                                    <ErrorMessage field="annual_quota" errors={policyErrors} />
                                    <Input id="annual-quota" type="number" min={0} max={50} step={leavePolicy.allow_half_day ? "0.5" : "1"} value={leavePolicy.annual_quota} onChange={(e) => handlePolicyUpdate("annual_quota", parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="monthly-quota">Monthly Quota</Label>
                                    <ErrorMessage field="monthly_quota" errors={policyErrors} />
                                    <Input id="monthly-quota" type="number" min={0} max={50} step="0.1" value={leavePolicy.monthly_quota || ""} onChange={(e) => handlePolicyUpdate("monthly_quota", parseFloat(e.target.value))} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Common Rules</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5"><Label>Allow Half Day</Label><p className="text-sm text-muted-foreground">Enable 0.5 day leave requests</p></div>
                                <Switch checked={leavePolicy.allow_half_day} onCheckedChange={(checked) => handlePolicyUpdate("allow_half_day", checked)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5"><Label>Attachment Required</Label><p className="text-sm text-muted-foreground">Force document upload</p></div>
                                <Switch checked={leavePolicy.attachment_required} onCheckedChange={(checked) => handlePolicyUpdate("attachment_required", checked)} />
                            </div>
                            <div className="space-y-2 border-t pt-2">
                                <div className="flex items-center justify-between"><Label>Allow Carry Forward</Label><Switch checked={leavePolicy.allow_carry_forward} onCheckedChange={(checked) => handlePolicyUpdate("allow_carry_forward", checked)} /></div>
                                {leavePolicy.allow_carry_forward && (
                                    <div className="grid grid-cols-2 gap-2 items-center pl-4 border-l-2"><Label className="text-xs">Max Days</Label><Input type="number" min={0} max={50} className="h-8" value={leavePolicy.max_carry_forward || ""} onChange={(e) => handlePolicyUpdate("max_carry_forward", parseFloat(e.target.value))} /></div>
                                )}
                            </div>
                            <div className="space-y-2 border-t pt-2">
                                <div className="flex items-center justify-between"><Label>Allow Negative Balance</Label><Switch checked={leavePolicy.allow_negative_balance} onCheckedChange={(checked) => handlePolicyUpdate("allow_negative_balance", checked)} /></div>
                                {leavePolicy.allow_negative_balance && (
                                    <div className="grid grid-cols-2 gap-2 items-center pl-4 border-l-2"><Label className="text-xs">Max Days</Label><Input type="number" min={0} max={50} className="h-8" value={leavePolicy.max_negative_balance || ""} onChange={(e) => handlePolicyUpdate("max_negative_balance", parseFloat(e.target.value))} /></div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Leave Type Distribution</CardTitle><Button size="sm" onClick={handleAddDistributionRow}><Plus className="h-4 w-4 mr-1" /> Create Type</Button></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Leave Type</TableHead><TableHead>Allocated Days</TableHead><TableHead>Carry Fwd</TableHead><TableHead>Neg Bal</TableHead><TableHead>Max/Req</TableHead><TableHead></TableHead></TableRow></TableHeader>
                            <TableBody>
                                {leavePolicy.distribution.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <SearchableSelect 
                                                value={row.leave_type} 
                                                onChange={(val) => handleDistributionUpdate(row.id, "leave_type", val)}
                                                options={["Casual Leave", "Sick Leave", "Earned Leave", "Maternity Leave"]}
                                                placeholder="Select Type"
                                            />
                                        </TableCell>
                                        <TableCell><Input type="number" min={0} max={50} value={row.allocated_days} onChange={(e) => handleDistributionUpdate(row.id, "allocated_days", parseFloat(e.target.value) || 0)} /></TableCell>
                                        <TableCell><Switch checked={row.carry_forward} onCheckedChange={(checked) => handleDistributionUpdate(row.id, "carry_forward", checked)} /></TableCell>
                                        <TableCell><Switch checked={row.negative_balance} onCheckedChange={(checked) => handleDistributionUpdate(row.id, "negative_balance", checked)} /></TableCell>
                                        <TableCell><Input type="number" min={0} max={50} value={row.max_per_request || ""} onChange={(e) => handleDistributionUpdate(row.id, "max_per_request", parseFloat(e.target.value))} /></TableCell>
                                        <TableCell><Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleRemoveDistributionRow(row.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="mt-4 flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                            <span className="font-medium">Total Allocated:</span>
                            <div className="flex items-center gap-2"><span className={cn("text-lg font-bold", isQuotaMatched ? "text-green-600" : "text-red-600")}>{totalAllocated}</span><span className="text-muted-foreground">/ {leavePolicy.annual_quota}</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div >
        );
    };

    const renderFormFields = () => {
        return (
            <div className="grid gap-4 py-4">
                {(selectedMaster !== "LeavePolicy") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="master-name" className="text-right">Name <span className="text-red-500">*</span></Label>
                        <Input 
                            id="master-name" 
                            value={formData.name || ""} 
                            maxLength={20} 
                            onChange={e => {
                                // Only allow letters and spaces (no numbers or special characters)
                                let value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                // Prevent only whitespace - if trimmed value is empty, don't allow it
                                if (value.trim() === '' && value.length > 0) {
                                    value = '';
                                }
                                setFormData({ ...formData, name: value });
                            }} 
                            className="col-span-3" 
                        />
                    </div>
                )}
                {selectedMaster === "State" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="country-select" className="text-right">Country <span className="text-red-500">*</span></Label>
                        <div className="col-span-3">
                            <SearchableSelect
                                placeholder="Select Country"
                                value={formData.country_id ? String(formData.country_id) : undefined}
                                options={activeCountries.map(c => ({ label: c.country_name, value: String(c.id) }))}
                                onChange={(val) => {
                                    const country = activeCountries.find(c => c.id == parseInt(val));
                                    setFormData({ ...formData, country_id: parseInt(val), country: country?.country_name || "" });
                                }}
                            />
                        </div>
                    </div>
                )}
                {selectedMaster === "City" && (
                    <div className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="country-select" className="text-right">Country <span className="text-red-500">*</span></Label>
                            <div className="col-span-3">
                                <SearchableSelect
                                    placeholder="Select Country"
                                    value={formData.country_id ? String(formData.country_id) : undefined}
                                    options={activeCountries.map(c => ({ label: c.country_name, value: String(c.id) }))}
                                    onChange={(val) => {
                                        setFormData({ ...formData, country_id: parseInt(val), state_id: undefined });
                                    }}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="state-select" className="text-right">State <span className="text-red-500">*</span></Label>
                            <div className="col-span-3">
                                <SearchableSelect
                                    placeholder={formData.country_id ? "Select State" : "Select Country first"}
                                    value={formData.state_id ? String(formData.state_id) : undefined}
                                    options={statesDropdown.map(s => ({ label: s.state_name, value: String(s.id) }))}
                                    onChange={(val) => {
                                        setFormData({ ...formData, state_id: parseInt(val) });
                                    }}
                                    disabled={!formData.country_id}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status <span className="text-red-500">*</span></Label>
                    <div className="col-span-3">
                        <SearchableSelect 
                            value={formData.status} 
                            onChange={(val) => setFormData({ ...formData, status: val as "Active" | "Inactive" })}
                            options={["Active", "Inactive"]}
                            placeholder="Select Status"
                        />
                    </div>
                </div>
            </div>
        );
    };

    const renderUserRolesForm = () => {
        return (
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-code" className="text-right">Code <span className="text-red-500">*</span></Label>
                    <Input id="role-code" value={formData.code || ""} maxLength={20} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-name" className="text-right">Name <span className="text-red-500">*</span></Label>
                    <Input id="role-name" value={formData.name || ""} maxLength={50} onChange={e => setFormData({ ...formData, name: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-desc" className="text-right">Description</Label>
                    <Textarea id="role-desc" value={formData.description || ""} maxLength={200} onChange={e => setFormData({ ...formData, description: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status <span className="text-red-500">*</span></Label>
                    <div className="col-span-3">
                        <SearchableSelect 
                            value={formData.status} 
                            onChange={(val) => setFormData({ ...formData, status: val as "Active" | "Inactive" })}
                            options={["Active", "Inactive"]}
                            placeholder="Select Status"
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex flex-col gap-2 shrink-0">
                <h1 className="text-3xl font-bold tracking-tight">Core Master</h1>
                <p className="text-muted-foreground">Manage and configure all system master data tables and reference lists.</p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col min-h-0">
                <div className="border-b border-border shrink-0">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        {MASTER_TYPES.filter(type => type !== "LeavePolicy" && type !== "UserRoles").map(type => (
                            <TabsTrigger key={type} value={MASTER_SLUGS[type]} className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap">
                                {MASTER_LABELS[type]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <div className="m-0 h-full flex flex-col gap-6 mt-6 overflow-y-auto pr-2 pb-6 custom-scrollbar">
                    {/* Only show content if authorized */}
                    {(selectedMaster === "LeavePolicy" || selectedMaster === "UserRoles" || isMenuVisible(universalKey)) ? (
                        <>
                            <AppListToolbar
                                search={{
                                    placeholder: `Search ${selectedMaster}...`,
                                    value: searchTerm,
                                    onChange: setSearchTerm
                                }}
                                actions={(selectedMaster !== "LeavePolicy" && (
                                    selectedMaster === "UserRoles" ? true : canCreate(universalKey)
                                )) ? [
                                    {
                                        label: `Create ${selectedMaster === "UserRoles" ? "User Role" : selectedMaster}`,
                                        icon: <Plus className="mr-2 h-4 w-4" />,
                                        onClick: handleAddClick
                                    }
                                ] : []}
                            />

                            <Card>
                                <CardHeader className="pb-3"><CardTitle>{selectedMaster === "LeavePolicy" ? "Leave Policy Configuration" : `${selectedMaster} List`}</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="rounded-md border">
                                        <Table className="table-fixed w-full">
                                            <TableHeader><TableRow className="bg-muted/50">{renderTableHeaders()}<TableHead className="text-center w-[100px] min-w-[100px]">Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {selectedMaster === "Country" ? (
                                                    isListLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="h-32 text-center">
                                                                <div className="flex flex-col items-center justify-center gap-3">
                                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : countryError ? (
                                                        <TableRow><TableCell colSpan={3} className="h-24 text-center text-red-500">Failed to load countries.</TableCell></TableRow>
                                                    ) : countryApiRecords.length === 0 ? (
                                                        <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No records found for Country.</TableCell></TableRow>
                                                    ) : (
                                                        countryApiRecords.map((item) => (
                                                            <TableRow key={item.id}>
                                                                {renderTableRow(item)}
                                                                <TableCell className="text-center">
                                                                    <TableActionButtons
                                                                        onEdit={canEdit(universalKey) ? () => { void handleEditClick(item); } : undefined}
                                                                        onDelete={canDelete(universalKey) ? () => handleDeleteClick(item.id) : undefined}
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )
                                                ) : selectedMaster === "State" ? (
                                                    isListLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="h-32 text-center">
                                                                <div className="flex flex-col items-center justify-center gap-3">
                                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : stateError ? (
                                                        <TableRow><TableCell colSpan={4} className="h-24 text-center text-red-500">Failed to load states.</TableCell></TableRow>
                                                    ) : stateApiRecords.length === 0 ? (
                                                        <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No records found for State.</TableCell></TableRow>
                                                    ) : (
                                                        stateApiRecords.map((item) => (
                                                            <TableRow key={item.id}>
                                                                {renderTableRow(item)}
                                                                <TableCell className="text-center">
                                                                    <TableActionButtons
                                                                        onEdit={canEdit(universalKey) ? () => { void handleEditClick(item); } : undefined}
                                                                        onDelete={canDelete(universalKey) ? () => handleDeleteClick(item.id) : undefined}
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )
                                                ) : selectedMaster === "City" ? (
                                                    isListLoading ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="h-32 text-center">
                                                                <div className="flex flex-col items-center justify-center gap-3">
                                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : cityError ? (
                                                        <TableRow><TableCell colSpan={5} className="h-24 text-center text-red-500">Failed to load cities.</TableCell></TableRow>
                                                    ) : cityApiRecords.length === 0 ? (
                                                        <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No records found for City.</TableCell></TableRow>
                                                    ) : (
                                                        cityApiRecords.map((item) => (
                                                            <TableRow key={item.id}>
                                                                {renderTableRow(item)}
                                                                <TableCell className="text-center">
                                                                    <TableActionButtons
                                                                        onEdit={canEdit(universalKey) ? () => { void handleEditClick(item); } : undefined}
                                                                        onDelete={canDelete(universalKey) ? () => handleDeleteClick(item.id) : undefined}
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )
                                                ) : selectedMaster === "LeavePolicy" ? (
                                                    <TableRow key={leavePolicy.id}>
                                                        {renderTableRow(leavePolicy as any)}
                                                        <TableCell className="text-center">
                                                            <TableActionButtons
                                                                onEdit={() => setIsDialogOpen(true)}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    currentData.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                                No records found for {selectedMaster}.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        currentData.map((item) => (
                                                            <TableRow key={item.id}>
                                                                {renderTableRow(item)}
                                                                <TableCell className="text-center">
                                                                    <TableActionButtons
                                                                        onEdit={() => handleEditClick(item)}
                                                                        onDelete={() => handleDeleteClick(item.id)}
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                            {selectedMaster === "Country" && !isListLoading && countryPagination && countryPagination.totalCount > 0 && (
                                <DataTablePagination
                                    currentPage={countryPage}
                                    totalPages={countryPagination.totalPages}
                                    totalItems={countryPagination.totalCount}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCountryPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            )}
                            {selectedMaster === "State" && !isListLoading && statePagination && statePagination.totalCount > 0 && (
                                <DataTablePagination
                                    currentPage={statePage}
                                    totalPages={statePagination.totalPages}
                                    totalItems={statePagination.totalCount}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setStatePage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            )}
                            {selectedMaster === "City" && !isListLoading && cityPagination && cityPagination.totalCount > 0 && (
                                <DataTablePagination
                                    currentPage={cityPage}
                                    totalPages={cityPagination.totalPages}
                                    totalItems={cityPagination.totalCount}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCityPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            )}
                            {selectedMaster !== "LeavePolicy" && selectedMaster !== "Country" && selectedMaster !== "State" && selectedMaster !== "City" && filteredData.length > 0 && (
                                <DataTablePagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalItems={filteredData.length}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            )}
                        </CardContent>
                    </Card>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[400px] bg-muted/20 rounded-lg border border-dashed gap-4">
                            <div className="p-4 rounded-full bg-muted">
                                <Search className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold">Access Denied</h3>
                                <p className="text-sm text-muted-foreground max-w-[300px]">
                                    You don't have permission to access the {MASTER_LABELS[selectedMaster] || selectedMaster} module.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent
                    className={
                        selectedMaster === "LeavePolicy"
                            ? "sm:max-w-[900px] h-[80vh] flex flex-col p-6"
                            : selectedMaster === "Country" || selectedMaster === "State" || selectedMaster === "City"
                              ? "w-[95%] max-w-xl max-h-[85vh] overflow-hidden p-0 flex flex-col"
                              : "sm:max-w-[500px]"
                    }
                >
                    {selectedMaster === "Country" || selectedMaster === "State" || selectedMaster === "City" ? (
                        <>
                            <div className="shrink-0 border-b px-6 py-5">
                                <DialogTitle>
                                    {editingId ? "Edit" : "Create"} {selectedMaster}
                                </DialogTitle>
                                <DialogDescription>
                                    Configure the details for this entry.
                                </DialogDescription>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-5">
                                <div className="relative">
                                    {isFormDetailLoading && (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 rounded-md min-h-[120px]">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">Loading...</p>
                                        </div>
                                    )}
                                    {renderFormFields()}
                                </div>
                            </div>

                            <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => handleDialogOpenChange(false)}
                                    disabled={isSubmitting || isFormDetailLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSubmitting || isFormDetailLoading}
                                    loading={isSubmitting}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingId || selectedMaster === "LeavePolicy" ? "Edit" : "Create"}{" "}
                                    {selectedMaster === "LeavePolicy"
                                        ? "Policy"
                                        : selectedMaster === "UserRoles"
                                          ? "User Role"
                                          : selectedMaster}
                                </DialogTitle>
                                <DialogDescription>
                                    Configure the details for this {selectedMaster === "LeavePolicy" ? "policy" : "entry"}.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="relative">
                                {isFormDetailLoading && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 rounded-md min-h-[120px]">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Loading...</p>
                                    </div>
                                )}
                                {selectedMaster === "LeavePolicy" ? (
                                    <div className="flex-1 overflow-y-auto pr-2 -mr-2">{renderLeavePolicyForm()}</div>
                                ) : selectedMaster === "UserRoles" ? (
                                    renderUserRolesForm()
                                ) : (
                                    renderFormFields()
                                )}
                            </div>
                            <DialogFooter className="mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => handleDialogOpenChange(false)}
                                    disabled={isSubmitting || isFormDetailLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={
                                        selectedMaster === "LeavePolicy"
                                            ? () => {
                                                  handleSavePolicy();
                                                  setIsDialogOpen(false);
                                              }
                                            : handleSave
                                    }
                                    disabled={
                                        (selectedMaster === "LeavePolicy" &&
                                            (Object.keys(policyErrors).length > 0 ||
                                                leavePolicy.distribution.reduce(
                                                    (sum, item) => sum + (item.allocated_days || 0),
                                                    0
                                                ) !== leavePolicy.annual_quota)) ||
                                        isSubmitting ||
                                        isFormDetailLoading
                                    }
                                    loading={isSubmitting}
                                >
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Record</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={confirmDelete} 
                            loading={isDeleting} 
                            disabled={isDeleting}
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

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
    return (<Badge variant={status === "Active" ? "default" : "secondary"} className={status === "Active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>{status}</Badge>);
}
