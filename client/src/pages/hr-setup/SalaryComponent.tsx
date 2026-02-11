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
import { Search, Plus, Edit, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// --- Types ---

type ComponentType = "earning" | "deduction" | "reimbursement";

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

  // Reimbursement specific
  reimbursementType?: string;
  maxAmount?: number;
  attachmentRequired?: boolean;
  taxable?: boolean;
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
    type: "earning",
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
    type: "deduction",
    name: "Provident Fund",
    active: true,
    showInPayslip: true,
    deductionType: "Provident Fund",
    frequency: "recurring"
  },
  {
    id: "3",
    code: "FUEL",
    type: "reimbursement",
    name: "Fuel Reimbursement",
    active: true,
    reimbursementType: "Fuel Reimbursement",
    maxAmount: 5000,
    attachmentRequired: true,
    taxable: false
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
  const [activeTab, setActiveTab] = useState<ComponentType>("earning");

  // --- Sync Route to State ---


  // components: The master list of all salary components. 
  const [components, setComponents] = useState<SalaryComp[]>(initialComponents);

  // searchTerm: Stores the current input in the search bar.
  // Used to filter the displayed list within the active tab.
  const [searchTerm, setSearchTerm] = useState("");

  // currentPage: Tracks pagination for the data table.
  // Used to slice the filtered data array for display.
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
  const [isCustomReimbursement, setIsCustomReimbursement] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  
  // Dropdown states for searchable components
  const [openEarningTypeDropdown, setOpenEarningTypeDropdown] = useState(false);
  const [openDeductionTypeDropdown, setOpenDeductionTypeDropdown] = useState(false);
  const [openReimbursementTypeDropdown, setOpenReimbursementTypeDropdown] = useState(false);

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

  const reimbursementTypeOptions = [
    "Fuel Reimbursement",
    "Mobile Reimbursement",
    "Travel Reimbursement",
    "Meal Reimbursement",
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
      attachmentRequired: true, // Default for Reimbursement
      taxable: false,           // Default for Reimbursement
      earningType: "",          // Initialize earning type
      deductionType: "",        // Initialize deduction type
      reimbursementType: ""     // Initialize reimbursement type
    });
    setIsCustomEarning(false);
    setIsCustomDeduction(false);
    setIsCustomReimbursement(false);
    setEditingId(null);
    // Reset dropdown states
    setOpenEarningTypeDropdown(false);
    setOpenDeductionTypeDropdown(false);
    setOpenReimbursementTypeDropdown(false);
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
    if (component.type === 'earning' && component.earningType === 'Custom') {
      setIsCustomEarning(true);
    } else {
      setIsCustomEarning(false);
    }

    if (component.type === 'reimbursement' && component.reimbursementType === 'Custom') {
      setIsCustomReimbursement(true);
    } else {
      setIsCustomReimbursement(false);
    }

    setIsModalOpen(true);
  };

  // --- Sync Route to State ---
  useEffect(() => {
    // Determine current tab from URL or default to 'earning'
    const currentTab = (paramsTab?.tab || paramsNew?.tab || paramsEdit?.tab) as ComponentType;
    const currentId = paramsEdit?.id;

    // Tab Sync
    if (currentTab && ['earning', 'deduction', 'reimbursement'].includes(currentTab)) {
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
    if (activeTab === 'earning') {
      const hasBasic = formData.code && formData.earningType && formData.name;
      const customValid = isCustomEarning ? !!formData.name : true;
      return !!(hasBasic && customValid);
    }

    if (activeTab === 'deduction') {
      const hasBasic = formData.code && formData.deductionType && formData.name && formData.frequency;
      const customValid = isCustomDeduction ? !!formData.name : true;
      return !!(hasBasic && customValid);
    }

    if (activeTab === 'reimbursement') {
      return !!(formData.code && formData.name && formData.reimbursementType && (formData.maxAmount || 0) > 0);
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

  const handleReimbursementTypeChange = (value: string) => {
    if (value === "Custom") {
      setIsCustomReimbursement(true);
      setFormData(prev => ({ ...prev, reimbursementType: value, name: "" }));
    } else {
      setIsCustomReimbursement(false);
      setFormData(prev => ({ ...prev, reimbursementType: value, name: value }));
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
          description: `${activeTab === 'earning' ? 'Earning' : activeTab === 'deduction' ? 'Deduction' : 'Reimbursement'} updated successfully.` 
        });
      } else {
        // Create New
        const newId = (Math.random() * 10000).toFixed(0);
        const newComponent = { ...formData, id: newId, type: activeTab } as SalaryComp;
        setComponents(prev => [...prev, newComponent]);
        toast({ 
          title: "Success", 
          description: `New ${activeTab} component created successfully.` 
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
  const filteredComponents = components.filter(c =>
    c.type === activeTab &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <p className="text-muted-foreground">Manage earnings, deductions, and reimbursement structures.</p>
      </div>

      {/* Sub-Tabs Navigation */}
      {/* 
                This section controls the main view mode. 
                Switching these tabs completely changes the table context (Columns & Data).
            */}
      <div className="flex space-x-2 border-b">
        <button
          onClick={() => setLocation("/hr-setup/salary-component/earning")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "earning" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Earnings
        </button>
        <button
          onClick={() => setLocation("/hr-setup/salary-component/deduction")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "deduction" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Deductions
        </button>
        <button
          onClick={() => setLocation("/hr-setup/salary-component/reimbursement")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "reimbursement" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Reimbursements
        </button>
      </div>

      {/* Action Bar: Search & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72 ml-2 flex items-center h-10 border border-zinc-400 rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:ring-inset">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 border-none shadow-none focus-visible:ring-0 bg-transparent h-full w-full"
          />
        </div>
        <Button onClick={() => setLocation(`/hr-setup/salary-component/${activeTab}/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {activeTab === 'earning' ? 'Add Earning' : activeTab === 'deduction' ? 'Add Deduction' : 'Add Reimbursement'}
        </Button>
      </div>

      {/* Main Content Card with Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Dynamic Table Headers based on Active Tab */}
                {activeTab === "earning" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>

                    <TableHead>Payslip</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </>
                )}
                {activeTab === "deduction" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Payslip</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </>
                )}
                {activeTab === "reimbursement" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Max Limit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
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
                <TableRow key={item.id}>
                  {/* --- Row Rendering Logic --- */}

                  {/* Earning Row */}
                  {activeTab === "earning" && (
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
                      <TableCell className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/hr-setup/salary-component/${activeTab}/${item.id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </>
                  )}

                  {/* Deduction Row */}
                  {activeTab === "deduction" && (
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
                      <TableCell className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/hr-setup/salary-component/${activeTab}/${item.id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </>
                  )}

                  {/* Reimbursement Row */}
                  {activeTab === "reimbursement" && (
                    <>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.reimbursementType}</TableCell>
                      <TableCell>₹{item.maxAmount}/mo</TableCell>
                      <TableCell>
                        <Badge className={item.active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                          {item.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/hr-setup/salary-component/${activeTab}/${item.id}`)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center px-1 py-4">
        <div className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredComponents.length)} of {filteredComponents.length} entries
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
              {editingId ? "Edit" : "New"} {activeTab === 'earning' ? 'Earning' : activeTab === 'deduction' ? 'Deduction' : 'Reimbursement'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 
                            FORM: Earnings
                            Only shown when activeTab === "earning"
                        */}
            {activeTab === 'earning' && (
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
            {activeTab === 'deduction' && (
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

            {/* 
                            FORM: Reimbursements
                            Only shown when activeTab === "reimbursement"
                            Note: No calculation type or Pay type needed here.
                        */}
            {activeTab === 'reimbursement' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.code || ""}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. FUEL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reimbursement Type <span className="text-red-500">*</span></Label>
                    <Popover open={openReimbursementTypeDropdown} onOpenChange={setOpenReimbursementTypeDropdown}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openReimbursementTypeDropdown}
                          className="w-full justify-between h-10 font-normal border-input"
                        >
                          <span className={cn(!formData.reimbursementType && "text-muted-foreground", formData.reimbursementType === "Custom" && "text-blue-600 font-medium")}>
                            {formData.reimbursementType === "Custom" 
                              ? "+ New Custom Reimbursement" 
                              : formData.reimbursementType || "Select Type"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInputBorderless placeholder="Search reimbursement type..." className="h-9" />
                          <CommandList className="max-h-[250px] overflow-y-auto">
                            <CommandEmpty>No reimbursement type found.</CommandEmpty>
                            <CommandGroup>
                              {reimbursementTypeOptions.map((type) => (
                                <CommandItem
                                  key={type}
                                  value={type}
                                  onSelect={() => {
                                    handleReimbursementTypeChange(type);
                                    setOpenReimbursementTypeDropdown(false);
                                  }}
                                  className={cn("cursor-pointer", type === "Custom" && "text-blue-600 font-medium")}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.reimbursementType === type ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {type === "Custom" ? "+ New Custom Reimbursement" : type}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reimbursement Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isCustomReimbursement}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Maximum Reimbursable Amount (₹ / month) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={formData.maxAmount || ""}
                    onChange={(e) => setFormData({ ...formData, maxAmount: parseFloat(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attach-req"
                      checked={formData.attachmentRequired}
                      onCheckedChange={(c) => setFormData({ ...formData, attachmentRequired: c as boolean })}
                    />
                    <Label htmlFor="attach-req">Attachment Required</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="taxable-req"
                      checked={formData.taxable}
                      onCheckedChange={(c) => setFormData({ ...formData, taxable: c as boolean })}
                    />
                    <Label htmlFor="taxable-req">Taxable</Label>
                  </div>
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
                {isSaving ? 'Saving...' : `Save ${activeTab === 'earning' ? 'Earning' : activeTab === 'deduction' ? 'Deduction' : 'Reimbursement'}`}
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
