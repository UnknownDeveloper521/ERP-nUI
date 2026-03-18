import React, { useState, useEffect } from "react";
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
import { Search, Plus, Edit, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Eye, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
// --- Types ---

type ComponentType = "earnings" | "deductions";

// Unified interface for all component types
interface SalaryComp {
  id: string;
  code: string;
  type: ComponentType;
  name: string; // Used as "Name in Payslip" for core components
  active: boolean;
  showInPayslip?: boolean; // Only for Earning/Deduction

  // Earning specific
  earningType?: string; // Dropdown value
  payType?: "fixed" | "variable";
  calculationType?: "flat" | "percent_basic" | "percent_ctc";
  amount?: number; // For flat amount
  percentage?: number; // For calculation based types

  // Deduction specific
  deductionType?: string; // Dropdown value
  frequency?: "one-time" | "recurring";
}

// --- Mock Data ---

/**
 * Initial mock data for the Salary Components screen.
 * This simulates the data that would typically come from a backend API.
 * We include examples for Earnings, Deductions, and Reimbursements.
 * 
 * ⚠️ SAFE GUARD: Added ONE mock record for each component type to prevent runtime crashes
 * This ensures salary component page never crashes when empty
 */
const initialComponents: SalaryComp[] = [
  {
    id: "1",
    code: "BASIC",
    type: "earnings",
    name: "Basic Salary",
    active: true,
    showInPayslip: true,
    earningType: "Basic",
    payType: "fixed",
    calculationType: "flat",
    amount: 30000
  },
  {
    id: "2",
    code: "PF",
    type: "deductions",
    name: "Provident Fund",
    active: true,
    showInPayslip: true,
    deductionType: "Provident Fund",
    frequency: "recurring"
  }
];

export default function SalaryComponent() {
  const { toast } = useToast();

  // --- Routing Hooks ---
  const [, setLocation] = useLocation();
  const [matchTab, paramsTab] = useRoute("/hr-setup/salary-component/:tab");
  const [matchNew, paramsNew] = useRoute("/hr-setup/salary-component/:tab/new");
  const [matchEdit, paramsEdit] = useRoute("/hr-setup/salary-component/:tab/:id");

  // --- State Variables ---

  // activeTab: Controls which sub-tab is currently visible (Earnings / Deductions / Reimbursements)
  // Used to filter the table data and determine which form to show in the modal.
  const [activeTab, setActiveTab] = useState<ComponentType>("earnings");

  // --- Sync Route to State ---


  // components: The master list of all salary components. 
  const [components, setComponents] = useState<SalaryComp[]>(initialComponents);

  // searchTerm: Stores the current input in the search bar.
  // Used to filter the displayed list within the active tab.
  const [searchTerm, setSearchTerm] = useState("");

  // currentPage: Tracks pagination for the data table.
  // Used to slice the filtered data array for display.
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState<string>("All");

  // Modal State - Controlled modal states for each type
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // editingId: Stores the ID of the component being edited, or null if creating a new one.
  // Used to determine if the logic is "Create" or "Update".
  const [editingId, setEditingId] = useState<string | null>(null);

  // formData: Holds the temporary state of the form being filled out in the modal.
  // We initialise it with default empty values.
  const [formData, setFormData] = useState<Partial<SalaryComp>>({});

  // isCustomEarning: Specific UI state for Earning form.
  // If true, enables a text input for the user to type a custom earning name.
  const [isCustomEarning, setIsCustomEarning] = useState(false);
  const [isCustomDeduction, setIsCustomDeduction] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // Dropdown states for searchable components
  const [openEarningTypeDropdown, setOpenEarningTypeDropdown] = useState(false);
  const [openDeductionTypeDropdown, setOpenDeductionTypeDropdown] = useState(false);

  // Dropdown options
  const earningTypeOptions = [
    "Basic",
    "House Rent Allowance",
    "Dearness Allowance",
    "Conveyance Allowance",
    "Bonus",
    "Custom"
  ];

  const deductionTypeOptions = [
    "Provident Fund",
    "Professional Tax",
    "Tax Deducted at Source",
    "Loan Recovery",
    "Custom"
  ];

  // --- Helper Logic ---

  /**
   * Resets the form data to default empty values based on the active tab type.
   * Needed when opening the "Add New" modal to ensure a clean slate.
   */
  const resetForm = () => {
    setFormData({
      type: activeTab,
      active: true,
      showInPayslip: true,
      earningType: "",          // Initialize earning type
      deductionType: "",        // Initialize deduction type
    });
    setIsCustomEarning(false);
    setIsCustomDeduction(false);
    setEditingId(null);
    // Reset dropdown states
    setOpenEarningTypeDropdown(false);
    setOpenDeductionTypeDropdown(false);
  };

  /**
   * Opens the modal in "Add" mode.
   * Called when the main "Add [Component]" button is clicked.
   */
  const handleAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  /**
   * Opens the modal in "Edit" mode with pre-filled data.
   * Called when the edit icon is clicked on a table row.
   * @param component The component object to be edited
   */
  const handleEdit = (component: SalaryComp) => {
    setEditingId(component.id);
    setFormData({ ...component });

    // specific check for custom earning type logic
    if (component.type === 'earnings' && component.earningType === 'Custom') {
      setIsCustomEarning(true);
    } else {
      setIsCustomEarning(false);
    }

    setIsModalOpen(true);
  };

  // --- Sync Route to State ---
  useEffect(() => {
    // Determine current tab from URL or default to 'earning'
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
      // Only update if not already in "New" state
      if (!isModalOpen || editingId !== null) {
        setIsModalOpen(true);
        setEditingId(null);
        resetForm();
      }
    } else if (matchEdit && currentId) {
      // Only update if we aren't already editing this ID
      if (!isModalOpen || editingId !== currentId) {
        const comp = components.find(c => c.id === currentId);
        if (comp) {
          setFormData(comp);
          setEditingId(currentId);
          setIsModalOpen(true);
        }
      }
    } else {
      // Close modal if open
      if (isModalOpen) {
        setIsModalOpen(false);
        setEditingId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchTab, matchNew, matchEdit, paramsTab?.tab, paramsNew?.tab, paramsEdit?.tab, paramsEdit?.id, components, activeTab, isModalOpen, editingId]);

  /**
   * Toggles the 'active' status of a component.
   * Called when the toggle switch in the table is clicked.
   * This updates the mock state immediately.
   */
  const toggleStatus = (id: string, currentStatus: boolean) => {
    setComponents((prev) =>
      prev.map(c => c.id === id ? { ...c, active: !currentStatus } : c)
    );

    toast({
      title: currentStatus ? "Component Deactivated" : "Component Activated",
      description: "Status updated successfully."
    });
  };

  /**
   * Validation Logic
   * Checks if the required fields for the current form are valid.
   * Used to disable the "Save" button if the form is incomplete.
   */
  const isFormValid = () => {
    if (activeTab === 'earnings') {
      const hasBasic = formData.code && formData.earningType && formData.name;
      const customValid = isCustomEarning ? !!formData.name : true;
      return !!(hasBasic && customValid);
    }

    if (activeTab === 'deductions') {
      const hasBasic = formData.code && formData.deductionType && formData.name && formData.frequency;
      const customValid = isCustomDeduction ? !!formData.name : true;
      return !!(hasBasic && customValid);
    }

    return false;
  };

  /**
   * Handles the specific logic when "Earning Type" dropdown changes.
   * If "+ New Custom Allowance" is selected, we toggle the custom input mode.
   */
  const handleEarningTypeChange = (value: string) => {
    if (value === "Custom") {
      setIsCustomEarning(true);
      setFormData(prev => ({ ...prev, earningType: value, name: "" })); // Clear name for custom entry
    } else {
      setIsCustomEarning(false);
      setFormData(prev => ({ ...prev, earningType: value, name: value })); // Auto-fill name
    }
  };

  /**
   * Handles "Deduction Type" change.
   */
  const handleDeductionTypeChange = (value: string) => {
    if (value === "Custom") {
      setIsCustomDeduction(true);
      setFormData(prev => ({ ...prev, deductionType: value, name: "" }));
    } else {
      setIsCustomDeduction(false);
      setFormData(prev => ({ ...prev, deductionType: value, name: value }));
    }
  };

  /**
   * Saves the form data to the main components list.
   * Handles both Create (new ID) and Update (existing ID) logic.
   */
  const handleSave = async () => {
    // Validation
    if (!isFormValid()) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Simulate async operation (replace with actual API call when needed)
      await new Promise(resolve => setTimeout(resolve, 500));

      if (editingId) {
        // Update existing
        setComponents(prev => prev.map(c => c.id === editingId ? { ...c, ...formData } as SalaryComp : c));
        toast({
          title: "Success",
          description: `${activeTab === 'earnings' ? 'Earning' : 'Deduction'} updated successfully.`
        });
      } else {
        // Create New
        const newId = (Math.random() * 10000).toFixed(0);
        const newComponent = { ...formData, id: newId, type: activeTab } as SalaryComp;
        setComponents(prev => [...prev, newComponent]);
        toast({
          title: "Success",
          description: `New ${activeTab === 'earnings' ? 'earnings' : 'deductions'} component created successfully.`
        });
      }

      // Close modal and reset form after successful save
      setIsModalOpen(false);
      resetForm();

      // Navigate back to list view
      setLocation(`/hr-setup/salary-component/${activeTab}`);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save component. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;

    try {
      // Simulate async operation (replace with actual API call when needed)
      await new Promise(resolve => setTimeout(resolve, 300));

      setComponents(prev => prev.filter(c => c.id !== editingId));
      toast({ title: "Success", description: "Component deleted successfully" });

      setOpenDeleteDialog(false);
      setIsModalOpen(false);
      resetForm();
      setLocation(`/hr-setup/salary-component/${activeTab}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete component. Please try again.",
        variant: "destructive"
      });
    }
  };

  // --- Filtering & Pagination Logic ---

  // 1. Filter by active tab (Earning/Deduction/Reimbursement)
  // 2. Filter by search term (Code or Name)
  // 3. Filter by status
  const filteredComponents = components.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(searchLower) || c.code.toLowerCase().includes(searchLower);

    // Status in component is boolean (active), but UI uses "Active" / "Inactive"
    const statusString = c.active ? "Active" : "Inactive";
    const matchesStatus = filterStatus === "All" || statusString === filterStatus;

    return c.type === activeTab && matchesSearch && matchesStatus;
  });

  // Calculate pagination slices
  const totalPages = Math.ceil(filteredComponents.length / itemsPerPage);
  const paginatedData = filteredComponents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="w-full sm:flex-1">
          <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search components..."
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Status
          </Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setLocation(`/hr-setup/salary-component/${activeTab}/new`)} className="h-10">
          <Plus className="h-4 w-4 mr-2" />
          {activeTab === 'earnings' ? 'Add Earning' : 'Add Deduction'}
        </Button>
      </div>

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
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No components found.
                    </TableCell>
                  </TableRow>
                ) : paginatedData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* --- Row Rendering Logic --- */}

                    {/* Earning Row */}
                    {activeTab === "earnings" && (
                      <>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>

                        <TableCell>
                          {item.showInPayslip ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={item.active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                            {item.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <TableActionButtons
                            onEdit={() => setLocation(`/hr-setup/salary-component/${activeTab}/${item.id}`)}
                          />
                        </TableCell>
                      </>
                    )}

                    {/* Deduction Row */}
                    {activeTab === "deductions" && (
                      <>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="capitalize">{item.frequency}</TableCell>
                        <TableCell>
                          {item.showInPayslip ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={item.active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                            {item.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <TableActionButtons
                            onEdit={() => setLocation(`/hr-setup/salary-component/${activeTab}/${item.id}`)}
                          />
                        </TableCell>
                      </>
                    )}

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredComponents.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            options={[10, 15, 30, 50]}
          />
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit" : "New"} {activeTab === 'earnings' ? 'Earning' : 'Deduction'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 
                            FORM: Earnings
                            Only shown when activeTab === "earnings"
                        */}
            {activeTab === 'earnings' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.code || ""}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. BASIC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Earning Type <span className="text-red-500">*</span></Label>
                    <Popover open={openEarningTypeDropdown} onOpenChange={setOpenEarningTypeDropdown}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openEarningTypeDropdown}
                          className="w-full justify-between h-10 font-normal border-input"
                        >
                          <span className={cn(!formData.earningType && "text-muted-foreground", formData.earningType === "Custom" && "text-blue-600 font-medium")}>
                            {formData.earningType === "Custom"
                              ? "+ New Custom Allowance"
                              : formData.earningType || "Select Type"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInputBorderless placeholder="Search earning type..." className="h-9" />
                          <CommandList className="max-h-[250px] overflow-y-auto">
                            <CommandEmpty>No earning type found.</CommandEmpty>
                            <CommandGroup>
                              {earningTypeOptions.map((type) => (
                                <CommandItem
                                  key={type}
                                  value={type}
                                  onSelect={() => {
                                    handleEarningTypeChange(type);
                                    setOpenEarningTypeDropdown(false);
                                  }}
                                  className={cn("cursor-pointer", type === "Custom" && "text-blue-600 font-medium")}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.earningType === type ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {type === "Custom" ? "+ New Custom Allowance" : type}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {isCustomEarning && (
                  <div className="space-y-2">
                    <Label>Earning Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter custom earning name"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Name in Payslip <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isCustomEarning} // Auto-filled unless custom
                  />
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
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PF, TDS"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deduction Type <span className="text-red-500">*</span></Label>
                  <Popover open={openDeductionTypeDropdown} onOpenChange={setOpenDeductionTypeDropdown}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openDeductionTypeDropdown}
                        className="w-full justify-between h-10 font-normal border-input"
                      >
                        <span className={cn(!formData.deductionType && "text-muted-foreground", formData.deductionType === "Custom" && "text-blue-600 font-medium")}>
                          {formData.deductionType === "Custom"
                            ? "+ New Custom Deduction"
                            : formData.deductionType || "Select Type"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInputBorderless placeholder="Search deduction type..." className="h-9" />
                        <CommandList className="max-h-[250px] overflow-y-auto">
                          <CommandEmpty>No deduction type found.</CommandEmpty>
                          <CommandGroup>
                            {deductionTypeOptions.map((type) => (
                              <CommandItem
                                key={type}
                                value={type}
                                onSelect={() => {
                                  handleDeductionTypeChange(type);
                                  setOpenDeductionTypeDropdown(false);
                                }}
                                className={cn("cursor-pointer", type === "Custom" && "text-blue-600 font-medium")}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.deductionType === type ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {type === "Custom" ? "+ New Custom Deduction" : type}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {(isCustomDeduction) && (
                  <div className="space-y-2">
                    <Label>Deduction Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter custom deduction name"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Name in Payslip <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isCustomDeduction}
                    placeholder="e.g. Provident Fund"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deduction Frequency <span className="text-red-500">*</span></Label>
                  <RadioGroup
                    value={formData.frequency}
                    onValueChange={(val: any) => setFormData({ ...formData, frequency: val })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="one-time" id="freq-one" />
                      <Label htmlFor="freq-one">One-time deduction</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="recurring" id="freq-rec" />
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

          <DialogFooter className="sm:justify-between">
            {editingId ? (
              <Button variant="destructive" onClick={() => setOpenDeleteDialog(true)}>
                Delete
              </Button>
            ) : <div />} {/* Spacer for new mode */}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsModalOpen(false);
                resetForm();
                setLocation(`/hr-setup/salary-component/${activeTab}`);
              }}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!isFormValid() || isSaving}
              >
                {isSaving ? 'Saving...' : `Save ${activeTab === 'earnings' ? 'Earning' : 'Deduction'}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the component
              <span className="font-medium text-foreground"> {formData.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
