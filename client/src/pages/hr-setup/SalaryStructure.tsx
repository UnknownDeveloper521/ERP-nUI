import React, { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isValid } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInputBorderless,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Plus, Edit, ArrowLeft, Trash2, Info, ChevronLeft, ChevronRight, Eye, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useCommonStore } from "@/store/commonStore";
import {
  useSalaryStructures,
  useSalaryStructure,
  useCreateSalaryStructure,
  useUpdateSalaryStructure,
  useDeleteSalaryStructure,
  useEarningComponents,
  useDeductionComponents,
/*
  useCalculationTypes,
*/
} from "@/hooks/useApi";

// --- Types ---

type CalcMode = "FLAT" | "PCT_CTC" | "PCT_BASIC" | "REMAINING";
type Status = "active" | "inactive";

interface SalaryComponent {
  id: number;
  name: string;
}

interface StructureEarning {
  salary_component_id: number;
  name: string;
  calcMode: CalcMode;
  value: number;
  base_component_id: number | null;
  isLocked?: boolean;
}

interface SalaryStructure {
  id: number;
  name: string;
  status: Status;
  earnings: StructureEarning[];
  deductions: StructureEarning[];
  createdAt: string;
}

/** API may omit `lines` or send null; never iterate a non-array. */
function getStructureDetailLines(detail: Record<string, unknown> | null | undefined): unknown[] {
  if (!detail || typeof detail !== "object") return [];
  const raw =
    (detail as { lines?: unknown }).lines ??
    (detail as { structure_lines?: unknown }).structure_lines ??
    (detail as { salary_structure_lines?: unknown }).salary_structure_lines;
  return Array.isArray(raw) ? raw : [];
}

/** When API sends only a display label (e.g. "Fixed Amount", "% of CTC") and no calculation_type_id. */
function inferCalcModeFromTypeLabel(label: string): CalcMode {
  const s = label.toLowerCase().trim();
  if (!s) return "FLAT";
  if (s.includes("remain")) return "REMAINING";
  if (s.includes("basic") && (s.includes("%") || s.includes("percent"))) return "PCT_BASIC";
  if (s.includes("ctc") || s.includes("cost to company")) return "PCT_CTC";
  if (s.includes("flat") || s.includes("fixed")) return "FLAT";
  return "FLAT";
}

// Helper to get default earnings with Basic and Special Allowance
const getDefaultEarnings = (components: SalaryComponent[], calcTypeMap: Record<string, number>): StructureEarning[] => {
  console.log('🔍 Searching for default components in:', components);
  console.log('🔍 Available calculation types:', calcTypeMap);
  
  const defaultEarnings: StructureEarning[] = [];

  // Only add Special Allowance if REMAINING calculation type exists
  if (calcTypeMap["REMAINING"]) {
    // Try multiple strategies to find Special Allowance
    let specialAllowanceComponent = components.find(c => 
      c.name.toLowerCase() === 'special allowance'
    );
    
    console.log('✅ Found Special Allowance component:', specialAllowanceComponent);

    // Add Special Allowance if found
    if (specialAllowanceComponent) {
      defaultEarnings.push({
        salary_component_id: specialAllowanceComponent.id,
        name: "Special Allowance", // Use clean label
        calcMode: "REMAINING",
        value: 0,
        base_component_id: null,
        isLocked: true,
      });
    }
  } else {
    console.warn('⚠️  REMAINING calculation type not found - Special Allowance will not be added by default');
  }

  console.log('📋 Final default earnings:', defaultEarnings);
  return defaultEarnings;
};

/** Unique Command value when multiple options share the same display label. */
const toCommandItemValue = (label: string, uniqueId: string | number) => `${label}|${uniqueId}`;

const commandLabelFilter = (value: string, search: string) => {
  const label = value.split("|")[0] ?? value;
  return label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
};

export default function SalaryStructurePage() {
  const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
  const permissionModule = "HR_Setup:Salary Structure";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();

  // --- State ---
  const [viewMode, setViewMode] = useState<"list" | "form">("list");

  // --- Routing Hooks ---
  const [, setLocation] = useLocation();
  const [matchNew] = useRoute("/hr-setup/salary-structure/new");
  const [matchEdit, params] = useRoute("/hr-setup/salary-structure/:id");

  // List View State
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form View State
  const [isEditMode, setIsEditMode] = useState(false);
  const [formState, setFormState] = useState<SalaryStructure>({
    id: 0,
    name: "",
    status: "active",
    earnings: [],
    deductions: [],
    createdAt: ""
  });
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // Dropdown State
  const [openAddDropdown, setOpenAddDropdown] = useState(false);
  const [openAddDeductionDropdown, setOpenAddDeductionDropdown] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");

  const queryClient = useQueryClient();
  
  // API Hooks
  const { data: structuresData, isLoading: isLoadingList } = useSalaryStructures(
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
    undefined
  );

  const editId = params?.id ? parseInt(params.id) : 0;
  const { data: structureDetail, isLoading: isLoadingDetail } = useSalaryStructure(editId);

  // Reset pagination to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const isFormActive = !!matchNew || !!matchEdit;
  const { data: earningComponentsData } = useEarningComponents({ status: 1 }, { enabled: isFormActive });
  const { data: deductionComponentsData } = useDeductionComponents({ status: 1 }, { enabled: isFormActive });
  /*
  const { data: calculationTypesData } = useCalculationTypes(1, { enabled: isFormActive });
  */

  const createMutation = useCreateSalaryStructure();
  const updateMutation = useUpdateSalaryStructure();
  const deleteMutation = useDeleteSalaryStructure();

  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // Store-based master data for calculation types
  const storeCalculationTypes = useCommonStore((state) => state.calculationTypes);

  // Build calculation type mapping from global store data
  const calcTypeMap: Record<string, number> = {};
  const calcTypeReverseMap: Record<number, string> = {};

  storeCalculationTypes.forEach((ct: any) => {
    /**
     * MAPPING LOGIC EXPLANATION:
     * We need to map friendly frontend modes ('FLAT', 'PCT_CTC', etc.) to the dynamic 
     * database IDs found in entity_values. Because the backend doesn't always send 
     * strict codes, we use a two-tier approach:
     * 
     * 1. Primary: Use the pre-normalized 'code' property from our global commonStore.
     * 2. Safety Net: If the store code is missing/unknown, we perform a final "guess" 
     *    based on the record's name as a failsafe to ensure the Save button works.
     */
    let code = (ct.code || "").toUpperCase();
    
    // 2. Safety Net: if store code is missing, guess from name/raw code (backup)
    if (!code || code === "UNKNOWN") {
      const name = (ct.name || "").toUpperCase();
      const raw = (ct.value_code || "").toUpperCase();
      
      if (name.includes("FLAT") || name.includes("FIXED") || raw.includes("FLAT") || raw.includes("FIXED")) {
        code = "FLAT";
      } else if (name.includes("CTC") || raw.includes("CTC")) {
        code = "PCT_CTC";
      } else if (name.includes("BASIC") || raw.includes("BASIC")) {
        code = "PCT_BASIC";
      } else if (name.includes("REMAIN") || raw.includes("REMAIN")) {
        code = "REMAINING";
      }
    }

    if (code) {
      calcTypeMap[code] = ct.id;
      calcTypeReverseMap[ct.id] = code;
    }
  });

  const isStoreLoaded = useCommonStore((state) => state.isLoaded);
  const isLoadingCalcTypes = !isStoreLoaded && storeCalculationTypes.length === 0;
  const calcTypesError = isStoreLoaded && storeCalculationTypes.length === 0;

  /*
  if (calculationTypesData?.data?.records) {
    calculationTypesData.data.records.forEach((ct: any) => {
      // The backend returns: { id, name, code }
      ...
  const calcTypesError = !hasMappingData && calculationTypesData;
  */

  // Initialize default earnings when components are loaded and in new mode
  useEffect(() => {
    const availableComponents = earningComponentsData?.data?.records || [];
    
    // Debug: Log available components
    if (availableComponents.length > 0) {
      console.log('Available earning components:', availableComponents.map((c: SalaryComponent) => ({ id: c.id, name: c.name })));
    }
    
    if (matchNew && availableComponents.length > 0 && formState.earnings.length === 0 && storeCalculationTypes.length > 0) {
      const defaultEarnings = getDefaultEarnings(availableComponents, calcTypeMap);
      console.log('Default earnings created:', defaultEarnings);
      if (defaultEarnings.length > 0) {
        setFormState(prev => ({ ...prev, earnings: defaultEarnings }));
      }
    }
  }, [earningComponentsData, matchNew, formState.earnings.length, calcTypeMap, storeCalculationTypes]);

  // --- Sync Route to View State ---
  useEffect(() => {
    const routeId = params?.id;
    const availableComponents = earningComponentsData?.data?.records || [];

    if (matchNew) {
      if (isEditMode || viewMode !== "form" || formState.id !== 0) {
        setIsEditMode(false);
        setFormState({
          id: 0,
          name: "",
          status: "active",
          earnings: getDefaultEarnings(availableComponents, calcTypeMap),
          deductions: [],
          createdAt: ""
        });
        setViewMode("form");
      }
    } else if (matchEdit && routeId && structureDetail?.data) {
      if (viewMode !== "form" || formState.id !== parseInt(routeId)) {
        const detail = structureDetail.data as any;
        const deductionRecords = deductionComponentsData?.data?.records || [];
        const deductionIdSet = new Set(deductionRecords.map((c: { id?: number }) => Number(c.id)));
        const earningIdSet = new Set(availableComponents.map((c: SalaryComponent) => c.id));

        const linesArray = getStructureDetailLines(detail);
        const earningsArray = Array.isArray(detail.earnings) ? detail.earnings : [];
        const deductionsArray = Array.isArray(detail.deductions) ? detail.deductions : [];
        const useSplitEarningsDeductions =
          earningsArray.length > 0 || deductionsArray.length > 0;

        const typeNameToMode: Record<string, CalcMode> = {};
        // for (const ct of calculationTypesData?.data?.records || []) {
        for (const ct of storeCalculationTypes || []) {
          const id = Number(ct.id);
          const mode = calcTypeReverseMap[id] as CalcMode | undefined;
          if (mode) {
            typeNameToMode[String(ct.name || "").toLowerCase().trim()] = mode;
          }
        }

        const mapLine = (line: Record<string, unknown>, forceDeduction?: boolean): StructureEarning => {
          const componentName = String(line.component_name ?? line.componentName ?? line.name ?? "");
          const isBasic = componentName.toLowerCase().includes("basic");
          const calcTypeId = Number(line.calculation_type_id ?? line.calculationTypeId ?? 0);
          const typeLabel = String(line.calculation_type ?? line.calculationType ?? "").trim();
          let calcMode: CalcMode =
            (calcTypeReverseMap[calcTypeId] as CalcMode) ||
            typeNameToMode[typeLabel.toLowerCase()] ||
            inferCalcModeFromTypeLabel(typeLabel);
          if (!calcTypeId && !typeLabel) {
            calcMode = "FLAT";
          }
          const isSpecialAllowance =
            componentName.toLowerCase().includes("special allowance") ||
            componentName.toLowerCase().includes("special") ||
            componentName.toLowerCase().includes("fixed") ||
            calcMode === "REMAINING";

          const salaryComponentId = Number(
            line.salary_component_id ??
              line.salaryComponentId ??
              line.component_id ??
              line.componentId ??
              line.item_id ??
              0
          );

          return {
            salary_component_id: salaryComponentId,
            name: componentName,
            calcMode,
            value: Number(line.value_amount ?? line.valueAmount ?? 0),
            base_component_id: (line.base_component_id ?? line.baseComponentId ?? null) as number | null,
            isLocked: forceDeduction ? false : isBasic || isSpecialAllowance,
          };
        };

        const transformedEarnings: StructureEarning[] = [];
        const transformedDeductions: StructureEarning[] = [];

        if (useSplitEarningsDeductions) {
          for (const row of earningsArray) {
            transformedEarnings.push(mapLine(row as Record<string, unknown>, false));
          }
          for (const row of deductionsArray) {
            transformedDeductions.push(mapLine(row as Record<string, unknown>, true));
          }
        } else {
          for (const line of linesArray) {
            const raw = line as Record<string, unknown>;
            const sid = Number(
              raw.salary_component_id ??
                raw.salaryComponentId ??
                raw.component_id ??
                0
            );
            const row = mapLine(raw);
            const isDeductionLine = deductionIdSet.has(sid) && !earningIdSet.has(sid);
            if (isDeductionLine) {
              transformedDeductions.push({ ...row, isLocked: false });
            } else {
              transformedEarnings.push(row);
            }
          }
        }

        setIsEditMode(true);
        setFormState({
          id: Number(detail.id ?? 0),
          name: String(detail.structure_name ?? ""),
          status: (detail.status === true || detail.status === 1) ? "active" : "inactive",
          earnings: transformedEarnings,
          deductions: transformedDeductions,
          createdAt: ""
        });
        setViewMode("form");
      }
    } else {
      if (viewMode !== "list") {
        setViewMode("list");
      }
    }
  }, [matchNew, matchEdit, params?.id, structureDetail, viewMode, isEditMode, formState.id, earningComponentsData, deductionComponentsData, storeCalculationTypes]);

  // --- Actions: List View ---

  const structures = structuresData?.data?.records || [];
  const totalCount = structuresData?.data?.pagination?.totalCount || 0;
  const totalPages = structuresData?.data?.pagination?.totalPages || 1;

  const handleCreateNew = () => {
    queryClient.invalidateQueries({ queryKey: ['earning-components'] });
    queryClient.invalidateQueries({ queryKey: ['deduction-components'] });
    setLocation("/hr-setup/salary-structure/new");
  };

  const handleEdit = (structure: any) => {
    queryClient.invalidateQueries({ queryKey: ['earning-components'] });
    queryClient.invalidateQueries({ queryKey: ['deduction-components'] });
    setLocation(`/hr-setup/salary-structure/${structure.id}`);
  };

  // --- Actions: Form View ---

  const availableComponents: SalaryComponent[] = (earningComponentsData?.data?.records || []).map(
    (c: { id?: number; name?: string }) => ({
      id: Number(c.id),
      name: String(c.name || ""),
    })
  );
  const availableDeductionComponents: SalaryComponent[] = (deductionComponentsData?.data?.records || []).map(
    (c: { id?: number; name?: string }) => ({
      id: Number(c.id),
      name: String(c.name || ""),
    })
  );

  const addEarning = (component: SalaryComponent) => {
    if (formState.earnings.some(e => e.salary_component_id === component.id)) return;

    const newEarning: StructureEarning = {
      salary_component_id: component.id,
      name: component.name,
      calcMode: "FLAT",
      value: 0,
      base_component_id: null,
    };

    // Find the index of Special Allowance (locked component with REMAINING calc mode)
    const specialAllowanceIndex = formState.earnings.findIndex(e => e.isLocked && e.calcMode === "REMAINING");
    
    if (specialAllowanceIndex !== -1) {
      // Insert before Special Allowance
      const newEarnings = [...formState.earnings];
      newEarnings.splice(specialAllowanceIndex, 0, newEarning);
      setFormState(prev => ({ ...prev, earnings: newEarnings }));
    } else {
      // If no Special Allowance found, just append
      setFormState(prev => ({ ...prev, earnings: [...prev.earnings, newEarning] }));
    }
    
    setOpenAddDropdown(false);
  };

  const removeEarning = (index: number) => {
    const row = formState.earnings[index];
    if (row.isLocked) return;
    const newEarnings = formState.earnings.filter((_, i) => i !== index);
    setFormState(prev => ({ ...prev, earnings: newEarnings }));
  };

  const updateEarning = (index: number, field: keyof StructureEarning, value: any) => {
    setFormState(prev => {
      const newEarnings = [...prev.earnings];
      newEarnings[index] = { ...newEarnings[index], [field]: value };
      return { ...prev, earnings: newEarnings };
    });
  };

  const addDeduction = (component: SalaryComponent) => {
    if (formState.deductions.some((d) => d.salary_component_id === component.id)) return;

    const newDeduction: StructureEarning = {
      salary_component_id: component.id,
      name: component.name,
      calcMode: "FLAT",
      value: 0,
      base_component_id: null,
    };

    setFormState((prev) => ({ ...prev, deductions: [...prev.deductions, newDeduction] }));
    setOpenAddDeductionDropdown(false);
  };

  const removeDeduction = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      deductions: prev.deductions.filter((_, i) => i !== index),
    }));
  };

  const updateDeduction = (index: number, field: keyof StructureEarning, value: any) => {
    setFormState((prev) => {
      const next = [...prev.deductions];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, deductions: next };
    });
  };

  const basicEarningComponentId =
    availableComponents.find((c: SalaryComponent) => c.name.toLowerCase().includes("basic"))?.id ?? null;

  const updateDeductionCalcMode = (index: number, v: CalcMode) => {
    setFormState((prev) => {
      const next = [...prev.deductions];
      next[index] = {
        ...next[index],
        calcMode: v,
        value: 0,
        base_component_id: v === "PCT_BASIC" ? basicEarningComponentId : null,
      };
      return { ...prev, deductions: next };
    });
  };

  const handleSave = async () => {
    if (!formState.name.trim()) {
      toast({ title: "Error", description: "Structure Name is required", variant: "destructive" });
      return;
    }

    // Check if calculation types are loaded
    if (Object.keys(calcTypeMap).length === 0) {
      toast({ 
        title: "Error", 
        description: "Calculation types not loaded. Please refresh the page or check database configuration.", 
        variant: "destructive" 
      });
      console.error('❌ Cannot save: Calculation type mapping is empty', {
        storeCalculationTypes,
        hint: 'Check if the common store is loaded properly'
      });
      return;
    }

    for (const earning of formState.earnings) {
      if (earning.calcMode === "REMAINING") continue;
      if (earning.value <= 0) {
        toast({
          title: "Validation Error",
          description: `${earning.name} must have a value greater than 0`,
          variant: "destructive"
        });
        return;
      }
    }

    for (const d of formState.deductions) {
      if (d.calcMode === "REMAINING") continue;
      if (d.value <= 0) {
        toast({
          title: "Validation Error",
          description: `${d.name} (deduction) must have a value greater than 0`,
          variant: "destructive",
        });
        return;
      }
    }

    const mapLinePayload = (e: StructureEarning) => {
      const calculationTypeId = calcTypeMap[e.calcMode];

      if (!calculationTypeId) {
        console.error(`❌ No calculation_type_id found for calcMode: ${e.calcMode}`, {
          availableMapping: calcTypeMap,
          component: e.name,
        });
        throw new Error(`Calculation type mapping failed for ${e.calcMode}. Please refresh the page.`);
      }

      return {
        salary_component_id: e.salary_component_id,
        calculation_type_id: calculationTypeId,
        value_amount: e.value,
        base_component_id:
          e.calcMode === "PCT_BASIC" ? (e.base_component_id ?? basicEarningComponentId) : null,
      };
    };

    const payload = {
      structure_name: formState.name,
      status: formState.status === "active" ? 1 : 0,
      lines: [...formState.earnings.map(mapLinePayload), ...formState.deductions.map(mapLinePayload)],
    };

    console.log('💾 Saving salary structure with payload:', payload);

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({ id: formState.id, data: payload });
        toast({ title: "Success", description: "Structure updated successfully", variant: "success" });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Success", description: "Structure created successfully", variant: "success" });
      }
      setLocation("/hr-setup/salary-structure");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save structure", variant: "destructive" });
    }
  };

  const handleDeleteStructure = async () => {
    if (!formState.id) return;
    try {
      await deleteMutation.mutateAsync(formState.id);
      toast({ title: "Success", description: "Structure deleted successfully", variant: "success" });
      setOpenDeleteDialog(false);
      setLocation("/hr-setup/salary-structure");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete structure", variant: "destructive" });
    }
  };

  const isFormValid = () => {
    if (!formState.name.trim()) return false;
    for (const earning of formState.earnings) {
      if (earning.calcMode !== "REMAINING" && earning.value <= 0) {
        return false;
      }
    }
    for (const d of formState.deductions) {
      if (d.calcMode !== "REMAINING" && d.value <= 0) {
        return false;
      }
    }
    return true;
  };

  // --- Render ---

  if (viewMode === "list") {
    return (
      <div className="h-full flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Salary Structures</h1>
          <p className="text-muted-foreground text-sm">Define earnings and deductions rules for employee grades.</p>
        </div>

        <AppListToolbar
          search={{
            placeholder: "Search structure...",
            value: searchTerm,
            onChange: setSearchTerm
          }}
          actions={[
            ...(canCreate(permissionModule) ? [{
              label: "Add Structure",
              icon: <Plus className="h-4 w-4 mr-2" />,
              onClick: handleCreateNew
            }] : [])
          ]}
        />

        <Card>
          <CardContent className="pt-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Structure Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created On</TableHead>
                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingList ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : structures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No structures found.</TableCell>
                    </TableRow>
                  ) : structures.map(s => (
                    <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm">{s.structure_name}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs font-medium", s.status === true || s.status === 1 ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-200 text-slate-700 hover:bg-slate-300")}>
                          {s.status === true || s.status === 1 ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.created_at ? (isValid(parseISO(s.created_at)) ? format(parseISO(s.created_at), "dd-MM-yyyy") : s.created_at) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <TableActionButtons
                          onEdit={canEdit(permissionModule) ? () => handleEdit(s) : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          {!isLoadingList && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
    );
  }

  // --- View: Form ---

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/hr-setup/salary-structure")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditMode ? "Edit Salary Structure" : "Create Salary Structure"}
          </h1>
        </div>
      </div>

      {/* Section A: Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Structure Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Structure Name <span className="text-red-500">*</span></Label>
            <Input
              value={formState.name}
              onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Worker Grade A"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formState.status} onValueChange={(v: Status) => setFormState(prev => ({ ...prev, status: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section B: Earnings Builder */}
      <Card>
        <CardHeader className="pb-2">
          {/* New Header Style: Uppercase, spaced out with fixed width for left column */}
          <div className="flex items-center uppercase text-xs font-semibold text-muted-foreground tracking-wider mb-2 px-2">
            <div className="w-[350px]">Salary Components</div>
            <div>Calculation Type</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Section Title */}
          <div className="font-semibold text-lg px-2">Earnings</div>

          {/* Rows Container */}
          <div className="space-y-1">
            {formState.earnings.map((earning: StructureEarning, index: number) => (
              <div key={earning.salary_component_id} className="flex items-start py-4 px-2 border-b border-dashed hover:bg-muted/30 transition-colors min-h-[60px]">

                {/* Left: Component Name (Fixed Width to align with header) */}
                <div className="flex flex-col w-[350px] shrink-0 gap-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {earning.name}
                    {earning.calcMode === "REMAINING" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent>Monthly CTC - Sum of all other components</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {earning.calcMode === "REMAINING" && (
                    <div className="text-xs text-muted-foreground leading-relaxed max-w-[320px]">
                      Monthly CTC - Sum of all other components
                    </div>
                  )}
                </div>

                {/* Right: Controls (Input Group) */}
                <div className="flex items-center gap-4 flex-1">
                  {earning.calcMode === "REMAINING" ? (
                    <div className="text-sm font-medium text-muted-foreground w-[300px]">Remaining Amount</div>
                  ) : (
                    <div className="flex items-center">
                      {/* Input Group: Unified Wrapper with shared border */}
                      <div className="flex items-center w-[300px] border border-gray-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-ring focus-within:border-primary overflow-hidden h-9">
                        <Input
                          type="number"
                          min={0}
                          value={earning.value || ""}
                          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            // Block non-numeric characters e, +, -, ., ,
                            if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const rawVal = e.target.value.replace(/\D/g, ""); // Remove non-numeric
                            if (rawVal === "") {
                              updateEarning(index, 'value', 0);
                              return;
                            }

                            const isPercentage = earning.calcMode.startsWith('PCT_');
                            const limit = isPercentage ? 2 : 8;
                            
                            if (rawVal.length > limit) return;

                            updateEarning(index, 'value', parseInt(rawVal));
                          }}
                          className="flex-1 border-none shadow-none focus-visible:ring-0 rounded-none h-full px-3"
                          placeholder="0.00"
                        />
                        {/* Vertical Divider */}
                        <div className="w-[1px] h-full bg-gray-300" />
                        <Select
                          value={earning.calcMode}
                          onValueChange={(v: CalcMode) => {
                            updateEarning(index, "calcMode", v);
                            updateEarning(index, "value", 0);
                          }}
                        >
                          <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 rounded-none h-full bg-muted/10 hover:bg-muted/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent side="bottom">
                            <SelectItem value="FLAT">Flat Amount</SelectItem>
                            <SelectItem value="PCT_CTC">% of CTC</SelectItem>
                            {/* Context-specific options: 
                                Basic only allows Flat or % of CTC. 
                                Others additionally allow % of Basic.
                                REMAINING is strictly for Special Allowance. */}
                            {!earning.name.toLowerCase().includes('basic') && (
                              <SelectItem value="PCT_BASIC">% of Basic</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Delete Action */}
                  <div className="flex-1 flex justify-start pl-4">
                    {!earning.isLocked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                        onClick={() => removeEarning(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            ))}

            {/* Static Special Allowance Row - Always Displayed */}
            {formState.earnings.length > 0 && !formState.earnings.some(e => e.calcMode === "REMAINING") && (
              <div className="flex items-start py-4 px-2 border-b border-dashed hover:bg-muted/30 transition-colors min-h-[60px]">
                {/* Left: Component Name */}
                <div className="flex flex-col w-[350px] shrink-0 gap-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    Special Allowance
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Monthly CTC - Sum of all other components</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed max-w-[320px]">
                    Monthly CTC - Sum of all other components
                  </div>
                </div>

                {/* Right: Display Only */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-sm font-medium text-muted-foreground w-[300px]">Remaining Amount</div>
                  <div className="flex-1 flex justify-start pl-4">
                    {/* No delete button for static row */}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add Button: Simple Text/Link style */}
          <div className="pt-2 px-2">
            <Popover open={openAddDropdown} onOpenChange={setOpenAddDropdown}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 pl-0">
                  <Plus className="mr-2 h-4 w-4" /> Add Earning
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start" side="bottom">
                <Command filter={commandLabelFilter}>
                  <CommandInputBorderless placeholder="Search earning component..." className="h-9" />
                  <CommandList className="max-h-[250px] overflow-y-auto">
                    <CommandEmpty>No earning component found.</CommandEmpty>
                    <CommandGroup heading="Available Earnings">
                      {availableComponents
                        .filter((c: SalaryComponent) => {
                          const name = (c.name || "").toLowerCase();
                          // Exclude Special Allowance as it is a default/managed component
                          const isSpecialAllowance = name === "special allowance";
                          const isAlreadyAdded = formState.earnings.some(fe => fe.salary_component_id === c.id);
                          return !isSpecialAllowance && !isAlreadyAdded;
                        })
                        .map((c: SalaryComponent) => (
                          <CommandItem
                            key={c.id}
                            value={toCommandItemValue(c.name, c.id)}
                            onSelect={() => {
                              addEarning(c);
                              setOpenAddDropdown(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Plus className="mr-2 h-4 w-4 text-green-600" />
                            {c.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

        </CardContent>
      </Card>

      {/* Section C: Deductions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center uppercase text-xs font-semibold text-muted-foreground tracking-wider mb-2 px-2">
            <div className="w-[350px]">Salary Components</div>
            <div>Calculation Type</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="font-semibold text-lg px-2">Deductions</div>

          <div className="space-y-1">
            {formState.deductions.map((row: StructureEarning, index: number) => (
              <div
                key={`deduction-${index}-${row.salary_component_id}`}
                className="flex items-start py-4 px-2 border-b border-dashed hover:bg-muted/30 transition-colors min-h-[60px]"
              >
                <div className="flex flex-col w-[350px] shrink-0 gap-1">
                  <div className="font-medium text-sm">{row.name}</div>
                </div>

                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center">
                    <div className="flex items-center w-[300px] border border-gray-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-ring focus-within:border-primary overflow-hidden h-9">
                      <Input
                        type="number"
                        min={0}
                        value={row.value || ""}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                          if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const rawVal = e.target.value.replace(/\D/g, "");
                          if (rawVal === "") {
                            updateDeduction(index, "value", 0);
                            return;
                          }
                          const isPercentage = row.calcMode.startsWith("PCT_");
                          const limit = isPercentage ? 2 : 8;
                          if (rawVal.length > limit) return;
                          updateDeduction(index, "value", parseInt(rawVal, 10));
                        }}
                        className="flex-1 border-none shadow-none focus-visible:ring-0 rounded-none h-full px-3"
                        placeholder="0"
                      />
                      <div className="w-[1px] h-full bg-gray-300" />
                      <Select
                        value={row.calcMode}
                        onValueChange={(v: CalcMode) => updateDeductionCalcMode(index, v)}
                      >
                        <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 rounded-none h-full bg-muted/10 hover:bg-muted/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                          <SelectItem value="FLAT">fixed amount</SelectItem>
                          <SelectItem value="PCT_CTC">% OF CTC</SelectItem>
                          <SelectItem value="PCT_BASIC">% of basic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex-1 flex justify-start pl-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                      onClick={() => removeDeduction(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 px-2">
            <Popover open={openAddDeductionDropdown} onOpenChange={setOpenAddDeductionDropdown}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 pl-0">
                  <Plus className="mr-2 h-4 w-4" /> Add Deduction
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start" side="bottom">
                <Command filter={commandLabelFilter}>
                  <CommandInputBorderless placeholder="Search deduction component..." className="h-9" />
                  <CommandList className="max-h-[250px] overflow-y-auto">
                    <CommandEmpty>No deduction component found.</CommandEmpty>
                    <CommandGroup heading="Available Deductions">
                      {availableDeductionComponents
                        .filter((c: SalaryComponent) => !formState.deductions.some((fd) => fd.salary_component_id === c.id))
                        .map((c: SalaryComponent) => (
                          <CommandItem
                            key={c.id}
                            value={toCommandItemValue(c.name, c.id)}
                            onSelect={() => {
                              addDeduction(c);
                              setOpenAddDeductionDropdown(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Plus className="mr-2 h-4 w-4 text-green-600" />
                            {c.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center bg-gray-50 p-4 border-t mt-8">
        <div>
          {formState.id > 0 && canDelete(permissionModule) && (
            <Button variant="destructive" onClick={() => setOpenDeleteDialog(true)}>
              Delete Structure
            </Button>
          )}
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setLocation("/hr-setup/salary-structure")}>Cancel</Button>
          {((formState.id && canEdit(permissionModule)) || (!formState.id && canCreate(permissionModule))) && (
            <Button 
              onClick={handleSave} 
              disabled={!isFormValid() || isLoadingCalcTypes || calcTypesError || isSubmitting}
              loading={isSubmitting}
              title={calcTypesError ? "Calculation types not loaded" : ""}
              className="disabled:bg-[#E5E7EB] disabled:text-gray-500 disabled:opacity-100"
            >
              {formState.id ? "Update Structure" : "Save Structure"}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the structure
              <span className="font-medium text-foreground"> {formState.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStructure} loading={isSubmitting} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
