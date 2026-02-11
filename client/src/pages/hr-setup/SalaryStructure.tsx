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
import { Search, Plus, Edit, ArrowLeft, Trash2, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// --- Types ---

type CalcMode = "FLAT" | "PCT_CTC" | "PCT_BASIC" | "REMAINING";
type Status = "active" | "inactive";

interface SalaryComponent {
  code: string;
  name: string;
  type: "earning" | "deduction"; // For now only earnings + fixed (which is earning)
}

interface StructureEarning {
  componentCode: string;
  name: string;
  calcMode: CalcMode;
  value: number; // 0 for Remaining
  isLocked?: boolean; // For Basic and Special Allowance
}

interface SalaryStructure {
  id: string;
  name: string;
  status: Status;
  earnings: StructureEarning[];
  createdAt: string;
}

// --- Mock Data ---

const mockComponents: SalaryComponent[] = [
  { code: "BASIC", name: "Basic", type: "earning" },
  { code: "HRA", name: "House Rent Allowance", type: "earning" },
  { code: "CONV", name: "Conveyance Allowance", type: "earning" },
  { code: "BONUS", name: "Performance Bonus", type: "earning" },
  { code: "LTA", name: "Leave Travel Allowance", type: "earning" },
  { code: "FIXED", name: "Special Allowance", type: "earning" },
];

const initialStructures: SalaryStructure[] = [];

// Default rows for new structure
const defaultEarnings: StructureEarning[] = [
  { componentCode: "BASIC", name: "Basic", calcMode: "PCT_CTC", value: 50, isLocked: true },
  { componentCode: "FIXED", name: "Special Allowance", calcMode: "REMAINING", value: 0, isLocked: true }
];

export default function SalaryStructurePage() {
  const { toast } = useToast();

  // --- State ---
  const [viewMode, setViewMode] = useState<"list" | "form">("list");

  const [structures, setStructures] = useState<SalaryStructure[]>(initialStructures);

  // --- Routing Hooks ---
  const [, setLocation] = useLocation();
  const [matchNew] = useRoute("/hr-setup/salary-structure/new");
  const [matchEdit, params] = useRoute("/hr-setup/salary-structure/:id");



  // List View State
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form View State
  const [isEditMode, setIsEditMode] = useState(false);
  const [formState, setFormState] = useState<SalaryStructure>({
    id: "",
    name: "",
    status: "active",
    earnings: [],
    createdAt: ""
  });
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  // Dropdown State
  const [openAddDropdown, setOpenAddDropdown] = useState(false);

  // --- Sync Route to View State ---
  useEffect(() => {
    const routeId = params?.id;

    if (matchNew) {
      // Only update if not already in "New" state (or if switching from something else)
      if (isEditMode || viewMode !== "form" || formState.id !== "") {
        setIsEditMode(false);
        setFormState({
          id: "",
          name: "",
          status: "active",
          earnings: [...defaultEarnings],
          createdAt: ""
        });
        setViewMode("form");
      }
    } else if (matchEdit && routeId) {
      // Only update if we aren't already editing this ID
      if (viewMode !== "form" || formState.id !== routeId) {
        const structure = structures.find(s => s.id === routeId);
        if (structure) {
          setIsEditMode(true);
          setFormState({ ...structure, earnings: structure.earnings.map(e => ({ ...e })) });
          setViewMode("form");
        }
      }
    } else {
      // List mode
      if (viewMode !== "list") {
        setViewMode("list");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchNew, matchEdit, params?.id, structures, viewMode, isEditMode, formState.id]);

  // --- Actions: List View ---

  const filteredStructures = structures.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const paginatedStructures = filteredStructures.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredStructures.length / itemsPerPage);

  const handleCreateNew = () => {
    setLocation("/hr-setup/salary-structure/new");
  };

  const handleEdit = (structure: SalaryStructure) => {
    setLocation(`/hr-setup/salary-structure/${structure.id}`);
  };

  // --- Actions: Form View ---

  const addEarning = (component: SalaryComponent) => {
    // Validation: Should not already exist (though UI filters it out)
    if (formState.earnings.some(e => e.componentCode === component.code)) return;

    // Insert before the last item (Special Allowance) so Special remains at bottom logically
    const newEarning: StructureEarning = {
      componentCode: component.code,
      name: component.name,
      calcMode: "FLAT",
      value: 0
    };

    const newEarnings = [...formState.earnings];
    // Insert before the last element (Special Allowance is usually last)
    // If Special isn't last for some reason, just push, but spec says it's always there.
    // We'll just push it before key locked items if we wanted to be strict, 
    // but simplest is just push to list, render order handles itself or we let user reorder (not requested).
    // Let's keep Special Allowance at the END visually.
    const fixedIdx = newEarnings.findIndex(e => e.componentCode === "FIXED");
    if (fixedIdx !== -1) {
      newEarnings.splice(fixedIdx, 0, newEarning);
    } else {
      newEarnings.push(newEarning);
    }

    setFormState(prev => ({ ...prev, earnings: newEarnings }));
    setOpenAddDropdown(false);
  };

  const removeEarning = (index: number) => {
    const row = formState.earnings[index];
    if (row.isLocked) return; // Should not happen via UI
    const newEarnings = formState.earnings.filter((_, i) => i !== index);
    setFormState(prev => ({ ...prev, earnings: newEarnings }));
  };

  const updateEarning = (index: number, field: keyof StructureEarning, value: any) => {
    const newEarnings = [...formState.earnings];
    newEarnings[index] = { ...newEarnings[index], [field]: value };

    // If changing type to PCT_BASIC, ensure we don't do it for Basic itself (handled by dropdown options)
    setFormState(prev => ({ ...prev, earnings: newEarnings }));
  };

  const handleSave = () => {
    // Validation
    if (!formState.name.trim()) {
      toast({ title: "Error", description: "Structure Name is required", variant: "destructive" });
      return;
    }

    // Validate rows
    for (const earning of formState.earnings) {
      if (earning.calcMode === "REMAINING") continue; // No value needed
      if (earning.value <= 0) {
        toast({
          title: "Validation Error",
          description: `${earning.name} must have a value greater than 0`,
          variant: "destructive"
        });
        return;
      }
    }

    const newStructure: SalaryStructure = {
      ...formState,
      id: isEditMode ? formState.id : `STR-${Date.now()}`,
      createdAt: isEditMode ? formState.createdAt : new Date().toISOString().split('T')[0]
    };

    let updatedStructures: SalaryStructure[];

    if (isEditMode) {
      updatedStructures = structures.map(s => s.id === newStructure.id ? newStructure : s);
      toast({ title: "Success", description: "Structure saved successfully" });
    } else {
      updatedStructures = [...structures, newStructure];
      toast({ title: "Success", description: "Structure created successfully" });
    }

    setStructures(updatedStructures);

    setLocation("/hr-setup/salary-structure");
  };

  const handleDeleteStructure = () => {
    if (!formState.id) return;
    const updatedStructures = structures.filter(s => s.id !== formState.id);
    setStructures(updatedStructures);
    toast({ title: "Success", description: "Structure deleted successfully" });
    setOpenDeleteDialog(false);
    setLocation("/hr-setup/salary-structure");
  };

  const isFormValid = () => {
    if (!formState.name.trim()) return false;
    for (const earning of formState.earnings) {
      if (earning.calcMode !== "REMAINING" && earning.value <= 0) {
        return false;
      }
    }
    return true;
  };

  // --- Render ---

  if (viewMode === "list") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Salary Structure</h1>
            <p className="text-muted-foreground">Manage salary structure templates and rules</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Search Box Wrapper: Matches standard Input style, using ring-inset to prevent clipping */}
          <div className="relative w-96 flex items-center h-10 border border-zinc-400 rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:ring-inset">
            {/* Icon: Standard positioning */}
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            {/* Input: Borderless, transparent, standard padding */}
            <Input
              placeholder="Search structure..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-none shadow-none focus-visible:ring-0 bg-transparent h-full w-full"
            />
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" /> Add Structure
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Structure Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStructures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">No structures found.</TableCell>
                  </TableRow>
                ) : paginatedStructures.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge className={s.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center px-1 py-4">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStructures.length)} of {filteredStructures.length} entries
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
            {formState.earnings.map((earning, index) => (
              <div key={earning.componentCode} className="flex items-center py-3 px-2 border-b border-dashed hover:bg-muted/30 transition-colors">

                {/* Left: Component Name (Fixed Width to align with header) */}
                <div className="flex flex-col w-[350px] shrink-0 gap-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {earning.name}
                    {earning.componentCode === "FIXED" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent>Monthly CTC - Sum of all other components</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {earning.componentCode === "FIXED" && (
                    <div className="text-xs text-muted-foreground">
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
                          onChange={(e) => updateEarning(index, 'value', parseFloat(e.target.value))}
                          className="flex-1 border-none shadow-none focus-visible:ring-0 rounded-none h-full px-3"
                          placeholder="0.00"
                        />
                        {/* Vertical Divider */}
                        <div className="w-[1px] h-full bg-gray-300" />
                        <Select
                          value={earning.calcMode}
                          onValueChange={(v: CalcMode) => updateEarning(index, 'calcMode', v)}
                        >
                          <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 rounded-none h-full bg-muted/10 hover:bg-muted/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent side="bottom">
                            <SelectItem value="FLAT">Flat Amount</SelectItem>
                            <SelectItem value="PCT_CTC">% of CTC</SelectItem>
                            {earning.componentCode !== "BASIC" && (
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
                <Command>
                  <CommandInputBorderless placeholder="Search earning component..." className="h-9" />
                  <CommandList className="max-h-[250px] overflow-y-auto">
                    <CommandEmpty>No earning component found.</CommandEmpty>
                    <CommandGroup heading="Available Earnings">
                      {mockComponents
                        .filter(c => 
                          c.type === "earning" && 
                          c.code !== "FIXED" && // Exclude Special Allowance (always present and locked)
                          !formState.earnings.some(fe => fe.componentCode === c.code)
                        )
                        .map(c => (
                          <CommandItem
                            key={c.code}
                            value={c.name}
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

      <div className="flex justify-between items-center bg-gray-50 p-4 border-t mt-8">
        <div>
          {formState.id && (
            <Button variant="destructive" onClick={() => setOpenDeleteDialog(true)}>
              Delete Structure
            </Button>
          )}
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setLocation("/hr-setup/salary-structure")}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isFormValid()}>
            {formState.id ? "Update Structure" : "Save Structure"}
          </Button>
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
            <AlertDialogAction onClick={handleDeleteStructure} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}