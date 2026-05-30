import React, { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation, useRoute } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  CommandEmpty,
  CommandGroup,
  CommandInputBorderless,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Eye, Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useCommonStore } from "@/store/commonStore";
import { DatePicker } from "@/components/shared/DatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";
import {
  useSalaryEarnings,
  useSalaryEarning,
  useCreateSalaryEarning,
  useUpdateSalaryEarning,
  useDeleteSalaryEarning,
  useSalaryDeductions,
  useSalaryDeduction,
  useCreateSalaryDeduction,
  useUpdateSalaryDeduction,
  useDeleteSalaryDeduction,
  useEarningTypes,
  useDeductionTypes,
} from "@/hooks/useApi";
// --- Types ---

type ComponentType = "earnings" | "deductions";

// Unified interface for all component types
interface SalaryComp {
  id: number;
  component_code: string;
  component_name?: string;
  type: ComponentType;
  name_in_payslip: string;
  component_type_id: number | null;
  active: boolean;
  showInPayslip?: boolean;
  status: number;

  // Earning specific
  earningType?: string;

  // Deduction specific
  deductionType?: string;
  frequency?: "ONE_TIME" | "RECURRING";
  deduction_frequency?: "ONE_TIME" | "RECURRING";
}

export default function SalaryComponent() {
  const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
  const permissionModule = "HR_Setup:Salary Component";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();

  // --- Routing Hooks ---
  const [, setLocation] = useLocation();
  const [matchTab, paramsTab] = useRoute("/hr-setup/salary-component/:tab");
  const [matchNew, paramsNew] = useRoute("/hr-setup/salary-component/:tab/new");
  const [matchEdit, paramsEdit] = useRoute("/hr-setup/salary-component/:tab/:id");

  // --- State Variables ---
  const [activeTab, setActiveTab] = useState<ComponentType>("earnings");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState<string>("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<SalaryComp>>({});
  const [isCustomEarning, setIsCustomEarning] = useState(false);
  const [isCustomDeduction, setIsCustomDeduction] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEarningTypeDropdown, setOpenEarningTypeDropdown] = useState(false);
  const [openDeductionTypeDropdown, setOpenDeductionTypeDropdown] = useState(false);
  const [nameError, setNameError] = useState("");

  // --- API Hooks ---
  // Earnings
  const statusFilter = filterStatus === "All" ? undefined : (filterStatus === "Active" ? 1 : 0);
  const { data: earningsData, isLoading: earningsLoading, refetch: refetchEarnings } = useSalaryEarnings(
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
    activeTab === 'earnings' ? statusFilter : undefined,
    { enabled: activeTab === 'earnings' }
  );
  const { data: earningDetail } = useSalaryEarning(editingId && activeTab === 'earnings' ? editingId : 0);
  const createEarningMutation = useCreateSalaryEarning();
  const updateEarningMutation = useUpdateSalaryEarning();
  const deleteEarningMutation = useDeleteSalaryEarning();

  // Deductions
  const { data: deductionsData, isLoading: deductionsLoading, refetch: refetchDeductions } = useSalaryDeductions(
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
    activeTab === 'deductions' ? statusFilter : undefined,
    { enabled: activeTab === 'deductions' }
  );
  const { data: deductionDetail } = useSalaryDeduction(editingId && activeTab === 'deductions' ? editingId : 0);
  const createDeductionMutation = useCreateSalaryDeduction();
  const updateDeductionMutation = useUpdateSalaryDeduction();
  const deleteDeductionMutation = useDeleteSalaryDeduction();

  const isSubmitting = createEarningMutation.isPending || 
                       updateEarningMutation.isPending || 
                       createDeductionMutation.isPending || 
                       updateDeductionMutation.isPending ||
                       deleteEarningMutation.isPending ||
                       deleteDeductionMutation.isPending;

  // Dropdowns (Restored separate API calls for earning and deduction types)
  const { data: earningTypesData } = useEarningTypes(1, { enabled: activeTab === 'earnings' && isModalOpen });
  const { data: deductionTypesData } = useDeductionTypes(1, { enabled: activeTab === 'deductions' && isModalOpen });

  // Store-based master data (Commented out in favor of separate API calls)
  /*
  const storeEarningTypes = useCommonStore((state) => state.earningTypes);
  const storeDeductionTypes = useCommonStore((state) => state.deductionTypes);
  */

  // Extract dropdown options from API data (Flexible mapping to handle various response structures)
  const rawEarningTypes = earningTypesData?.data?.data?.items || earningTypesData?.data?.data || earningTypesData?.data?.items || [];
  const earningTypeOptions = Array.isArray(rawEarningTypes) 
    ? rawEarningTypes.map((item: any) => item.name || item.earning_type_name) 
    : [];

  const rawDeductionTypes = deductionTypesData?.data?.data?.items || deductionTypesData?.data?.data || deductionTypesData?.data?.items || [];
  const deductionTypeOptions = Array.isArray(rawDeductionTypes) 
    ? rawDeductionTypes.map((item: any) => item.name || item.deduction_type_name) 
    : [];

  // Add "Custom" option to both
  const earningTypeOptionsWithCustom = [...earningTypeOptions, "Custom"];
  const deductionTypeOptionsWithCustom = [...deductionTypeOptions, "Custom"];

  // --- Helper Logic ---

  /**
   * Resets the form data to default empty values based on the active tab type.
   */
  const resetForm = () => {
    setFormData({
      type: activeTab,
      active: true,
      showInPayslip: true,
      status: 1,
      earningType: "",
      deductionType: "",
      component_name: "",
      component_type_id: null
    });
    setIsCustomEarning(false);
    setIsCustomDeduction(false);
    setEditingId(null);
    setOpenEarningTypeDropdown(false);
    setOpenDeductionTypeDropdown(false);
    setNameError("");
  };

  /**
   * Opens the modal in "Add" mode.
   */
  const handleAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  /**
   * Opens the modal in "Edit" mode with pre-filled data.
   */
  const handleEdit = (component: SalaryComp) => {
    setEditingId(component.id);
    setFormData({
      ...component,
      // Handle both boolean and number status values
      active: typeof component.status === 'boolean' ? component.status : component.status === 1,
      showInPayslip: component.showInPayslip,
    });

    // Check for custom earning/deduction type
    if (component.type === 'earnings' && component.earningType === 'Custom') {
      setIsCustomEarning(true);
    } else {
      setIsCustomEarning(false);
    }

    if (component.type === 'deductions' && component.deductionType === 'Custom') {
      setIsCustomDeduction(true);
    } else {
      setIsCustomDeduction(false);
    }

    setIsModalOpen(true);
  };

  // --- Sync Route to State ---
  useEffect(() => {
    const currentTab = (paramsTab?.tab || paramsNew?.tab || paramsEdit?.tab) as ComponentType;
    const currentId = paramsEdit?.id;

    // Tab Sync
    if (currentTab && ['earnings', 'deductions'].includes(currentTab)) {
      if (currentTab !== activeTab) {
        setActiveTab(currentTab);
        setCurrentPage(1);
      }
    }

    // Modal State Sync
    if (matchNew) {
      if (!isModalOpen || editingId !== null) {
        setIsModalOpen(true);
        setEditingId(null);
        resetForm();
      }
    } else if (matchEdit && currentId) {
      const numericId = parseInt(currentId);
      if (!isModalOpen || editingId !== numericId) {
        setEditingId(numericId);
        setIsModalOpen(true);
      }
    } else {
      if (isModalOpen) {
        setIsModalOpen(false);
        setEditingId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchTab, matchNew, matchEdit, paramsTab?.tab, paramsNew?.tab, paramsEdit?.tab, paramsEdit?.id, activeTab, isModalOpen, editingId]);

  // Load detail data when editing
  useEffect(() => {
    if (editingId && isModalOpen) {
      if (activeTab === 'earnings' && earningDetail?.data) {
        const detail = earningDetail.data as any;
        // Find earning type name from ID in API data
        const earningTypeName = (Array.isArray(rawEarningTypes) ? rawEarningTypes : []).find(
          (item: any) => Number(item.id) === Number(detail.component_type_id)
        )?.name || 'Custom';

        setFormData({
          id: detail.id,
          component_code: detail.component_code,
          component_type_id: detail.component_type_id,
          name_in_payslip: detail.name_in_payslip,
          showInPayslip: detail.show_in_payslip,
          // Handle both boolean and number status values
          active: typeof detail.status === 'boolean' ? detail.status : detail.status === 1,
          status: detail.status,
          type: 'earnings',
          earningType: earningTypeName,
          component_name: detail.component_name || detail.name_in_payslip,
        });

        setIsCustomEarning(earningTypeName === 'Custom');
      } else if (activeTab === 'deductions' && deductionDetail?.data) {
        const detail = deductionDetail.data as any;
        // Find deduction type name from ID in API data
        const deductionTypeName = (Array.isArray(rawDeductionTypes) ? rawDeductionTypes : []).find(
          (item: any) => Number(item.id) === Number(detail.component_type_id)
        )?.name || 'Custom';

        setFormData({
          id: detail.id,
          component_code: detail.component_code,
          component_type_id: detail.component_type_id,
          name_in_payslip: detail.name_in_payslip,
          deduction_frequency: detail.deduction_frequency,
          showInPayslip: detail.show_in_payslip,
          // Handle both boolean and number status values
          active: typeof detail.status === 'boolean' ? detail.status : detail.status === 1,
          status: detail.status,
          type: 'deductions',
          deductionType: deductionTypeName,
          component_name: detail.component_name || detail.name_in_payslip,
        });

        setIsCustomDeduction(deductionTypeName === 'Custom');
      }
    }
  }, [editingId, earningDetail, deductionDetail, activeTab, isModalOpen, earningTypesData, deductionTypesData]);

  /**
   * Toggles the 'active' status of a component (not used in current UI, kept for future)
   */
  const toggleStatus = (id: number, currentStatus: boolean) => {
    const newStatus = currentStatus ? 0 : 1;
    if (activeTab === 'earnings') {
      updateEarningMutation.mutate(
        { id, data: { status: newStatus } },
        {
          onSuccess: () => {
            toast({
              title: currentStatus ? "Component Deactivated" : "Component Activated",
              description: "Status updated successfully.",
              variant: "success",
            });
            refetchEarnings();
          },
          onError: (error: any) => {
            toast({
              title: "Error",
              description: error.message || "Failed to update status",
              variant: "destructive"
            });
          }
        }
      );
    } else {
      updateDeductionMutation.mutate(
        { id, data: { status: newStatus } },
        {
          onSuccess: () => {
            toast({
              title: currentStatus ? "Component Deactivated" : "Component Activated",
              description: "Status updated successfully.",
              variant: "success",
            });
            refetchDeductions();
          },
          onError: (error: any) => {
            toast({
              title: "Error",
              description: error.message || "Failed to update status",
              variant: "destructive"
            });
          }
        }
      );
    }
  };

  const isFormValid = () => {
    if (nameError) return false;

    if (activeTab === 'earnings') {
      const hasBasic = formData.component_code && formData.name_in_payslip;
      const typeValid = isCustomEarning || !!formData.component_type_id;
      const customValid = isCustomEarning ? !!formData.name_in_payslip : true;
      return !!(hasBasic && typeValid && customValid);
    }

    if (activeTab === 'deductions') {
      const hasBasic = formData.component_code && formData.name_in_payslip && formData.deduction_frequency;
      const typeValid = isCustomDeduction || !!formData.component_type_id;
      const customValid = isCustomDeduction ? !!formData.name_in_payslip : true;
      return !!(hasBasic && typeValid && customValid);
    }

    return false;
  };

  /**
   * Handles the specific logic when "Earning Type" dropdown changes.
   */
  const handleEarningTypeChange = (value: string) => {
    if (value === "Custom") {
      setIsCustomEarning(true);
      setFormData(prev => ({ 
        ...prev, 
        earningType: value, 
        component_name: "", 
        name_in_payslip: "", 
        component_type_id: null 
      }));
      setNameError("");
    } else {
      setIsCustomEarning(false);
      // Find the ID for this earning type from API data
      const earningTypeId = (Array.isArray(rawEarningTypes) ? rawEarningTypes : []).find(
        (item: any) => (item.name || item.earning_type_name) === value
      )?.id;
      setFormData(prev => ({ 
        ...prev, 
        earningType: value, 
        component_name: value,
        name_in_payslip: value, 
        component_type_id: earningTypeId 
      }));
    }
  };

  /**
   * Handles "Deduction Type" change.
   */
  const handleDeductionTypeChange = (value: string) => {
    if (value === "Custom") {
      setIsCustomDeduction(true);
      
      setFormData(prev => ({ 
        ...prev, 
        deductionType: value, 
        component_name: "",
        name_in_payslip: "", 
        component_type_id: null 
      }));
      setNameError("");
    } else {
      setIsCustomDeduction(false);
      // Find the ID for this deduction type from API data
      const deductionTypeId = (Array.isArray(rawDeductionTypes) ? rawDeductionTypes : []).find(
        (item: any) => (item.name || item.deduction_type_name) === value
      )?.id;
      setFormData(prev => ({ 
        ...prev, 
        deductionType: value, 
        component_name: value,
        name_in_payslip: value, 
        component_type_id: deductionTypeId 
      }));
    }
  };

  /**
   * Saves the form data.
   */
  const handleSave = async () => {
    if (!isFormValid()) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields.",
        variant: "destructive"
      });
      return;
    }

    const saveData: any = {
      component_code: formData.component_code,
      component_name: formData.component_name || formData.name_in_payslip,
      component_type_id: formData.component_type_id,
      name_in_payslip: formData.name_in_payslip,
      show_in_payslip: formData.showInPayslip !== undefined ? formData.showInPayslip : true,
      status: formData.active ? 1 : 0,
    };

    // Add deduction specific fields
    if (activeTab === 'deductions') {
      saveData.deduction_frequency = formData.deduction_frequency || 'RECURRING';
    }

    if (activeTab === 'earnings') {
      if (editingId) {
        // Update existing earning
        updateEarningMutation.mutate(
          { id: editingId, data: saveData },
          {
            onSuccess: () => {
              toast({
                title: "Success",
                description: "Earning updated successfully.",
                variant: "success"
              });
              setIsModalOpen(false);
              resetForm();
              setLocation(`/hr-setup/salary-component/${activeTab}`);
              refetchEarnings();
            },
            onError: (error: any) => {
              toast({
                title: "Error",
                description: error.message || "Failed to update earning",
                variant: "destructive"
              });
            }
          }
        );
      } else {
        // Create new earning
        createEarningMutation.mutate(
          saveData,
          {
            onSuccess: () => {
              toast({
                title: "Success",
                description: "New earning component created successfully.",
                variant: "success"
              });
              setIsModalOpen(false);
              resetForm();
              setLocation(`/hr-setup/salary-component/${activeTab}`);
              refetchEarnings();
            },
            onError: (error: any) => {
              toast({
                title: "Error",
                description: error.message || "Failed to create earning",
                variant: "destructive"
              });
            }
          }
        );
      }
    } else if (activeTab === 'deductions') {
      saveData.deduction_frequency = formData.deduction_frequency;

      if (editingId) {
        // Update existing deduction
        updateDeductionMutation.mutate(
          { id: editingId, data: saveData },
          {
            onSuccess: () => {
              toast({
                title: "Success",
                description: "Deduction updated successfully.",
                variant: "success"
              });
              setIsModalOpen(false);
              resetForm();
              setLocation(`/hr-setup/salary-component/${activeTab}`);
              refetchDeductions();
            },
            onError: (error: any) => {
              toast({
                title: "Error",
                description: error.message || "Failed to update deduction",
                variant: "destructive"
              });
            }
          }
        );
      } else {
        // Create new deduction
        createDeductionMutation.mutate(
          saveData,
          {
            onSuccess: () => {
              toast({
                title: "Success",
                description: "New deduction component created successfully.",
                variant: "success"
              });
              setIsModalOpen(false);
              resetForm();
              setLocation(`/hr-setup/salary-component/${activeTab}`);
              refetchDeductions();
            },
            onError: (error: any) => {
              toast({
                title: "Error",
                description: error.message || "Failed to create deduction",
                variant: "destructive"
              });
            }
          }
        );
      }
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;

    if (activeTab === 'earnings') {
      deleteEarningMutation.mutate(
        editingId,
        {
          onSuccess: () => {
            toast({ 
              title: "Success", 
              description: "Component deleted successfully",
              variant: "success" 
            });
            setOpenDeleteDialog(false);
            setIsModalOpen(false);
            resetForm();
            setLocation(`/hr-setup/salary-component/${activeTab}`);
            refetchEarnings();
          },
          onError: (error: any) => {
            toast({
              title: "Error",
              description: error.message || "Failed to delete component",
              variant: "destructive"
            });
          }
        }
      );
    } else {
      deleteDeductionMutation.mutate(
        editingId,
        {
          onSuccess: () => {
            toast({ 
              title: "Success", 
              description: "Component deleted successfully",
              variant: "success" 
            });
            setOpenDeleteDialog(false);
            setIsModalOpen(false);
            resetForm();
            setLocation(`/hr-setup/salary-component/${activeTab}`);
            refetchDeductions();
          },
          onError: (error: any) => {
            toast({
              title: "Error",
              description: error.message || "Failed to delete component",
              variant: "destructive"
            });
          }
        }
      );
    }
  };

  // --- Filtering & Pagination Logic ---

  // Get the appropriate data based on active tab
  const currentData = activeTab === 'earnings' ? earningsData : deductionsData;
  const isListLoading = activeTab === 'earnings' ? earningsLoading : deductionsLoading;

  // Transform API data to component format
  const transformedComponents: SalaryComp[] = currentData?.data?.records?.map((item: any) => ({
    id: item.id,
    component_code: item.component_code,
    name_in_payslip: item.name_in_payslip,
    component_type_id: item.component_type_id,
    showInPayslip: item.show_in_payslip,
    status: item.status,
    // Handle both boolean and number status values
    active: typeof item.status === 'boolean' ? item.status : item.status === 1,
    type: activeTab,
    deduction_frequency: item.deduction_frequency,
  })) || [];

  const totalPages = currentData?.data?.pagination?.totalPages || 1;
  const totalItems = currentData?.data?.pagination?.totalCount || 0;

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterStatus, activeTab]);

  // --- Render Helpers ---

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Salary Components</h1>
        <p className="text-muted-foreground">Manage earnings and deductions.</p>
      </div>

      {/* Sub-Tabs Navigation */}
      {/* 
                This section controls the main view mode. 
                Switching these tabs completely changes the table context (Columns & Data).
            */}
      <div className="flex space-x-2 border-b">
        <button
          onClick={() => setLocation("/hr-setup/salary-component/earnings")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "earnings" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Earnings
        </button>
        <button
          onClick={() => setLocation("/hr-setup/salary-component/deductions")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "deductions" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Deductions
        </button>
      </div>

      {/* Action Bar: Search & Add Button */}
      <AppListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search components..."
        }}
        filters={[
          {
            type: "select",
            label: "Status",
            value: filterStatus,
            onChange: setFilterStatus,
            searchable: true,
            options: [
              { label: "All Status", value: "All" },
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" }
            ]
          }
        ]}
        actions={[
          ...(canCreate(permissionModule) ? [{
            label: activeTab === 'earnings' ? 'Add Earning' : 'Add Deduction',
            onClick: () => setLocation(`/hr-setup/salary-component/${activeTab}/new`),
            icon: <Plus className="h-4 w-4" />,
            variant: "default" as any,
          }] : [])
        ]}
      />

      {/* Main Content Card with Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {/* Dynamic Table Headers based on Active Tab */}
                  {activeTab === "earnings" && (
                    <>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>

                      <TableHead>Payslip</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center w-[100px]">Actions</TableHead>
                    </>
                  )}
                  {activeTab === "deductions" && (
                    <>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Payslip</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center w-[100px]">Actions</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isListLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : transformedComponents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No components found.
                    </TableCell>
                  </TableRow>
                ) : transformedComponents.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* --- Row Rendering Logic --- */}

                    {/* Earning Row */}
                    {activeTab === "earnings" && (
                      <>
                        <TableCell className="font-medium">{item.component_code}</TableCell>
                        <TableCell>{item.name_in_payslip}</TableCell>

                        <TableCell>
                          {item.showInPayslip ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={item.active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200 font-medium"}>
                            {item.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <TableActionButtons
                            onEdit={canEdit(permissionModule) ? () => setLocation(`/hr-setup/salary-component/${activeTab}/${item.id}`) : undefined}
                          />
                        </TableCell>
                      </>
                    )}

                    {/* Deduction Row */}
                    {activeTab === "deductions" && (
                      <>
                        <TableCell className="font-medium">{item.component_code}</TableCell>
                        <TableCell>{item.name_in_payslip}</TableCell>
                        <TableCell className="capitalize">{item.deduction_frequency?.toLowerCase().replace('_', '-')}</TableCell>
                        <TableCell>
                          {item.showInPayslip ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={item.active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-slate-200 text-slate-700 hover:bg-slate-200 font-medium"}>
                            {item.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <TableActionButtons
                            onEdit={canEdit(permissionModule) ? () => setLocation(`/hr-setup/salary-component/${activeTab}/${item.id}`) : undefined}
                          />
                        </TableCell>
                      </>
                    )}

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!isListLoading && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              options={[10, 15, 30, 50]}
            />
          )}
        </CardContent>
      </Card>

      {/* --- Manage Modal (Add/Edit) --- */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsModalOpen(false);
          resetForm();
          setLocation(`/hr-setup/salary-component/${activeTab}`);
        }
      }}>
        <DialogContent className="w-[92%] sm:max-w-xl md:max-w-2xl max-h-[80vh] overflow-hidden p-0 flex flex-col gap-0">
          <div className="shrink-0 border-b bg-white p-5 sm:p-6">
            <DialogHeader className="p-0">
              <DialogTitle>
                {editingId ? "Edit" : "New"} {activeTab === 'earnings' ? 'Earning' : 'Deduction'}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
            {/* 
                            FORM: Earnings
                            Only shown when activeTab === "earnings"
                        */}
            {activeTab === 'earnings' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Code <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.component_code || ""}
                      onChange={(e) => setFormData({ ...formData, component_code: e.target.value.toUpperCase() })}
                      placeholder="e.g. BASIC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Earning Type <span className="text-red-500">*</span></Label>
                    <SearchableSelect
                      options={earningTypeOptionsWithCustom.map((type) => ({
                        label: type === "Custom" ? "+ New Earning Type" : type,
                        value: type,
                      }))}
                      value={formData.earningType || ""}
                      onChange={(val) => handleEarningTypeChange(val as string)}
                      placeholder="Select Type"
                    />
                  </div>
                </div>

                {isCustomEarning && (
                  <div className="space-y-2">
                    <Label>Earning Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.component_name || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, component_name: val, name_in_payslip: val });
                        if (val && !/^[a-zA-Z\s]*$/.test(val)) {
                          setNameError("Only alphabets and spaces are allowed");
                        } else {
                          setNameError("");
                        }
                      }}
                      placeholder="Enter custom earning name"
                      className={cn(nameError && "border-destructive focus-visible:ring-destructive")}
                    />
                    {nameError && <p className="text-[10px] text-destructive italic font-medium">{nameError}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Name in Payslip <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.name_in_payslip || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, name_in_payslip: val });
                      if (val && !/^[a-zA-Z\s]*$/.test(val)) {
                        setNameError("Only alphabets and spaces are allowed");
                      } else {
                        setNameError("");
                      }
                    }}
                    disabled={!isCustomEarning} // Auto-filled unless custom
                    className={cn(nameError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {!isCustomEarning && nameError && <p className="text-[10px] text-destructive italic font-medium">{nameError}</p>}
                </div>

                {/* Pay Type and Calculation Type removed as per request to simplify Component master. 
                    Calculation logic is now handled strictly in Salary Structure. */}

                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="show-payslip"
                    checked={formData.showInPayslip}
                    onCheckedChange={(c) => setFormData({ ...formData, showInPayslip: c })}
                  />
                  <Label htmlFor="show-payslip">Show this component in payslip</Label>
                </div>
              </div>
            )}

            {/* 
                            FORM: Deductions
                            Only shown when activeTab === "deduction"
                        */}
            {activeTab === 'deductions' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Code <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.component_code || ""}
                    onChange={(e) => setFormData({ ...formData, component_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PF, TDS"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deduction Type <span className="text-red-500">*</span></Label>
                  <SearchableSelect
                    options={deductionTypeOptionsWithCustom.map((type) => ({
                      label: type === "Custom" ? "+ New Deduction Type" : type,
                      value: type,
                    }))}
                    value={formData.deductionType || ""}
                    onChange={(val) => handleDeductionTypeChange(val as string)}
                    placeholder="Select Type"
                  />
                </div>
                {(isCustomDeduction) && (
                  <div className="space-y-2">
                    <Label>Deduction Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.component_name || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, component_name: val, name_in_payslip: val });
                        if (val && !/^[a-zA-Z\s]*$/.test(val)) {
                          setNameError("Only alphabets and spaces are allowed");
                        } else {
                          setNameError("");
                        }
                      }}
                      placeholder="Enter custom deduction name"
                      className={cn(nameError && "border-destructive focus-visible:ring-destructive")}
                    />
                    {nameError && <p className="text-[10px] text-destructive italic font-medium">{nameError}</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Name in Payslip <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.name_in_payslip || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, name_in_payslip: val });
                      if (val && !/^[a-zA-Z\s]*$/.test(val)) {
                        setNameError("Only alphabets and spaces are allowed");
                      } else {
                        setNameError("");
                      }
                    }}
                    disabled={!isCustomDeduction}
                    placeholder="e.g. Provident Fund"
                    className={cn(nameError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {!isCustomDeduction && nameError && <p className="text-[10px] text-destructive italic font-medium">{nameError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Deduction Frequency <span className="text-red-500">*</span></Label>
                  <RadioGroup
                    value={formData.deduction_frequency}
                    onValueChange={(val: any) => setFormData({ ...formData, deduction_frequency: val })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ONE_TIME" id="freq-one" />
                      <Label htmlFor="freq-one">One-time deduction</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="RECURRING" id="freq-rec" />
                      <Label htmlFor="freq-rec">Recurring deduction for subsequent payrolls</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="show-payslip-d"
                    checked={formData.showInPayslip}
                    onCheckedChange={(c) => setFormData({ ...formData, showInPayslip: c })}
                  />
                  <Label htmlFor="show-payslip-d">Show this component in payslip</Label>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-4">
              <Switch
                id="is-active"
                checked={formData.active}
                onCheckedChange={(c) => setFormData({ ...formData, active: c })}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>

          <div className="shrink-0 border-t bg-white p-5 sm:p-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {editingId ? (
              canDelete(permissionModule) && (
                <Button variant="destructive" onClick={() => setOpenDeleteDialog(true)}>
                  Delete
                </Button>
              )
            ) : <div />} {/* Spacer for new mode */}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsModalOpen(false);
                resetForm();
                setLocation(`/hr-setup/salary-component/${activeTab}`);
              }}>Cancel</Button>
              {((editingId && canEdit(permissionModule)) || (!editingId && canCreate(permissionModule))) && (
                <Button
                  onClick={handleSave}
                  disabled={!isFormValid() || isSubmitting}
                  loading={isSubmitting}
                  className="disabled:bg-border disabled:text-[#9CA3AF] disabled:opacity-100"
                >
                  {`Save ${activeTab === 'earnings' ? 'Earning' : 'Deduction'}`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the component
              <span className="font-medium text-foreground"> {formData.name_in_payslip}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} loading={isSubmitting} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
