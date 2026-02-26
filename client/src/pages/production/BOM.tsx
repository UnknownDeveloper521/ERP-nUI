import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, ChevronLeft, ChevronRight, ArrowLeft, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date to DD-MM-YYYY format
 */
const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

// ============================================================================
// SEARCHABLE SELECT COMPONENT (Matching MaterialOperation)
// ============================================================================

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

    return (
        <div className="space-y-2 flex-1">
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal border-input overflow-hidden"
                        disabled={disabled}
                    >
                        <span className={cn("truncate mr-2", !value && "text-muted-foreground")}>
                            {value || `Select ${label}`}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
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
                                                value === item ? "opacity-100" : "opacity-0"
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BOMRecord {
    id: number;
    bomCode: string;
    bomName: string;
    itemType: "FG" | "SFG";
    itemName: string;
    description?: string;
    status: "Active" | "Inactive";
    createdAt: string;
}

interface Item {
    id: number;
    code: string;
    name: string;
    type: "FG" | "SFG" | "RM";
    uom: string;
    metadata?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BOM() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();

    // Route matching
    const [matchNew] = useRoute("/production/bom/new");
    const [matchEdit, params] = useRoute("/production/bom/:id");

    const isFormView = matchNew || (matchEdit && params?.id !== "new");
    const editingId = params?.id ? parseInt(params.id) : null;

    // ============================================================================
    // STATE - LISTING PAGE
    // ============================================================================

    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Mock data for BOM records
    const [bomRecords, setBomRecords] = useState<BOMRecord[]>([
        {
            id: 1,
            bomCode: "BOM-2024-001",
            bomName: "Steel Frame BOM",
            itemType: "FG",
            itemName: "Heavy Duty Frame",
            description: "Standard industrial frame for heavy equipment, includes anti-corrosion coating requirements.",
            status: "Active",
            createdAt: "2024-01-15",
        },
        {
            id: 2,
            bomCode: "BOM-2024-002",
            bomName: "Plate Assembly BOM",
            itemType: "SFG",
            itemName: "Inner Support Plate",
            description: "Internal reinforcement assembly for the main chassis units.",
            status: "Active",
            createdAt: "2024-01-20",
        },
        {
            id: 3,
            bomCode: "BOM-2024-003",
            bomName: "Enclosure Housing BOM",
            itemType: "FG",
            itemName: "Control Box Housing",
            description: "Stainless steel housing for IP65 rated control assemblies.",
            status: "Active",
            createdAt: "2024-02-05",
        },
    ]);

    // Mock data for items selection
    const ALL_ITEMS: Item[] = [
        { id: 101, code: "FG-001", name: "Heavy Duty Frame", type: "FG", uom: "PCS", metadata: "Weight: 250kg, Dimensions: 2x1.5m" },
        { id: 102, code: "FG-002", name: "Control Box Housing", type: "FG", uom: "PCS", metadata: "Material: Stainless Steel, IP65 Rated" },
        { id: 201, code: "SFG-001", name: "Inner Support Plate", type: "SFG", uom: "PCS", metadata: "Thickness: 12mm, Material: Mild Steel" },
        { id: 202, code: "SFG-002", name: "Corner Bracket Set", type: "SFG", uom: "SET", metadata: "4 pieces per set, Zinc Plated" },
        { id: 301, code: "RM-001", name: "Steel Tube 50x50", type: "RM", uom: "METER", metadata: "Wall Thickness: 3mm" },
        { id: 302, code: "RM-002", name: "Welding Rods", type: "RM", uom: "KG", metadata: "Type: E6013, 2.5mm" },
        { id: 303, code: "RM-003", name: "Paint - Industrial Grey", type: "RM", uom: "LITER", metadata: "Epoxy based, High Gloss" },
    ];

    // ============================================================================
    // STATE - FORM VIEW
    // ============================================================================

    const [activeTab, setActiveTab] = useState(1);
    const [bomName, setBomName] = useState("");
    const [bomDescription, setBomDescription] = useState("");
    const [selectedMainItem, setSelectedMainItem] = useState<Item | null>(null);
    const [selectedComponents, setSelectedComponents] = useState<Item[]>([]);
    const [quantities, setQuantities] = useState<{ [itemId: number]: string }>({});
    const [errors, setErrors] = useState<{ [itemId: number]: string }>({});

    // Mouse tracking for popup
    const [hoveredItem, setHoveredItem] = useState<Item | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // ============================================================================
    // STATE - DIALOG VIEW (VIEW/EDIT)
    // ============================================================================

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");
    const [currentRecord, setCurrentRecord] = useState<BOMRecord | null>(null);
    const [dialogBomName, setDialogBomName] = useState("");
    const [dialogDescription, setDialogDescription] = useState("");
    const [dialogQuantities, setDialogQuantities] = useState<{ [itemId: number]: string }>({});
    const [dialogErrors, setDialogErrors] = useState<{ [itemId: number]: string }>({});

    // ============================================================================
    // HANDLERS
    // ============================================================================

    const filteredData = bomRecords.filter((item) => {
        const matchesSearch =
            item.bomCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.bomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.itemName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = typeFilter === "All" || item.itemType === typeFilter;

        return matchesSearch && matchesType;
    });

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleCreateBOM = () => {
        setLocation("/production/bom/new");
    };

    const handleEditBOM = (id: number) => {
        const record = bomRecords.find(r => r.id === id);
        if (record) {
            setCurrentRecord(record);
            setDialogMode("edit");
            setDialogBomName(record.bomName);
            setDialogDescription(record.description || "");
            // Set mock quantities for demo
            setDialogQuantities({ 301: "15.5", 302: "2.0" });
            setDialogOpen(true);
        }
    };

    const handleViewBOM = (id: number) => {
        const record = bomRecords.find(r => r.id === id);
        if (record) {
            setCurrentRecord(record);
            setDialogMode("view");
            setDialogBomName(record.bomName);
            setDialogDescription(record.description || "");
            // Set mock quantities for demo
            setDialogQuantities({ 301: "15.5", 302: "2.0" });
            setDialogOpen(true);
        }
    };

    const handleDialogQuantityChange = (itemId: number, value: string) => {
        setDialogQuantities(prev => ({ ...prev, [itemId]: value }));

        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            setDialogErrors(prev => ({ ...prev, [itemId]: "Invalid qty" }));
        } else {
            const newErrors = { ...dialogErrors };
            delete newErrors[itemId];
            setDialogErrors(newErrors);
        }
    };

    const handleSaveFromDialog = () => {
        // Validation check
        const hasErrors = Object.keys(dialogErrors).length > 0;
        if (hasErrors) {
            toast({ title: "Error", description: "Please fix the quantity errors", variant: "destructive" });
            return;
        }

        toast({ title: "Success", description: "BOM updated successfully" });
        setDialogOpen(false);
    };

    const handleDeleteFromDialog = () => {
        if (!currentRecord) return;

        // In a real app, this would be an API call
        setBomRecords(prev => prev.filter(r => r.id !== currentRecord.id));
        toast({ title: "Deleted", description: "BOM record has been removed", variant: "destructive" });
        setDialogOpen(false);
    };

    const toggleComponent = (item: Item) => {
        if (selectedComponents.some(c => c.id === item.id)) {
            setSelectedComponents(prev => prev.filter(c => c.id !== item.id));
            const newQuants = { ...quantities };
            delete newQuants[item.id];
            setQuantities(newQuants);
        } else {
            setSelectedComponents(prev => [...prev, item]);
        }
    };

    const handleQuantityChange = (itemId: number, value: string) => {
        setQuantities(prev => ({ ...prev, [itemId]: value }));

        // Validation logic
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            setErrors(prev => ({ ...prev, [itemId]: "Quantity must be greater than zero" }));
        } else {
            const newErrors = { ...errors };
            delete newErrors[itemId];
            setErrors(newErrors);
        }
    };

    const handleSaveBOM = () => {
        // Final Validation
        let hasErrors = false;
        const newErrors: { [itemId: number]: string } = {};

        if (!bomName.trim()) {
            toast({ title: "Error", description: "BOM Name is required", variant: "destructive" });
            return;
        }

        if (!selectedMainItem) {
            toast({ title: "Error", description: "Please select a main item", variant: "destructive" });
            return;
        }

        if (selectedComponents.length === 0) {
            toast({ title: "Error", description: "Please select at least one component", variant: "destructive" });
            return;
        }

        selectedComponents.forEach(comp => {
            const val = parseFloat(quantities[comp.id] || "0");
            if (val <= 0) {
                newErrors[comp.id] = "Quantity must be greater than zero";
                hasErrors = true;
            }
        });

        if (hasErrors) {
            setErrors(newErrors);
            toast({ title: "Validation Error", description: "Please fix the quantities", variant: "destructive" });
            return;
        }

        toast({ title: "Success", description: "Bill of Material saved successfully" });
        setLocation("/production/bom");
    };

    const resetForm = () => {
        setActiveTab(1);
        setBomName("");
        setBomDescription("");
        setSelectedMainItem(null);
        setSelectedComponents([]);
        setQuantities({});
        setErrors({});
    };

    useEffect(() => {
        if (!isFormView) {
            resetForm();
        }
    }, [isFormView]);

    // ============================================================================
    // RENDER - FORM VIEW (PLACEHOLDER)
    // ============================================================================

    if (isFormView) {
        return (
            <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setLocation("/production/bom")} className="h-8 w-8">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {editingId ? "Edit Bill of Material" : "Create Bill of Material"}
                        </h1>
                    </div>
                </div>

                {/* BOM Details Section - Moved to Top */}
                <Card className="border-muted/50 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-5 bg-muted/10">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BOM Name <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="e.g., Heavy Chassis Assembly - V1"
                                value={bomName}
                                onChange={(e) => setBomName(e.target.value)}
                                className="h-10 text-sm bg-background focus-visible:ring-primary/20"
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description / Notes</Label>
                            <Input
                                placeholder="Add technical notes or description..."
                                value={bomDescription}
                                onChange={(e) => setBomDescription(e.target.value)}
                                className="h-10 text-sm bg-background focus-visible:ring-primary/20"
                            />
                        </div>
                    </div>
                </Card>

                <div className="flex gap-2 border-b">
                    {[1, 2, 3].map((tab) => (
                        <div
                            key={tab}
                            className={cn(
                                "pb-2 px-4 text-sm font-medium transition-colors border-b-2",
                                activeTab === tab
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground"
                            )}
                        >
                            {tab === 1 ? "1. Select FG/SFG" : tab === 2 ? "2. Select Components" : "3. Define Quantities"}
                        </div>
                    ))}
                </div>

                <Card className="flex-1 overflow-hidden flex flex-col">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle className="text-lg">
                            {activeTab === 1 ? "Select Main Item (FG/SFG)" :
                                activeTab === 2 ? "Select Component Items (SFG/RM)" :
                                    "Review and Define Quantities"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-6 relative">
                        {/* Mouse Tracked Metadata Popup */}
                        {hoveredItem && (
                            <div
                                className="fixed z-[100] pointer-events-none bg-popover border shadow-xl rounded-lg p-3 w-64 animate-in fade-in zoom-in-95 duration-200"
                                style={{
                                    left: mousePos.x + 15,
                                    top: mousePos.y + 15
                                }}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider h-4">{hoveredItem.type}</Badge>
                                        <span className="text-[10px] font-mono text-muted-foreground">{hoveredItem.code}</span>
                                    </div>
                                    <h4 className="text-xs font-bold leading-none">{hoveredItem.name}</h4>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {hoveredItem.metadata}
                                    </p>
                                    <div className="pt-1.5 border-t">
                                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">UOM: {hoveredItem.uom}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 1 && (
                            <div className="space-y-4">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Select Main Item (FG/SFG)</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-1">
                                    {ALL_ITEMS.filter(i => i.type !== "RM").map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedMainItem(item)}
                                            onMouseMove={(e) => {
                                                setHoveredItem(item);
                                                setMousePos({ x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className={cn(
                                                "relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md group",
                                                selectedMainItem?.id === item.id
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-muted hover:border-muted-foreground/30"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant={item.type === "FG" ? "default" : "secondary"} className="text-[10px] h-5 px-1.5 uppercase font-bold tracking-wider">{item.type}</Badge>
                                                {selectedMainItem?.id === item.id && (
                                                    <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                                                        <Check className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="font-semibold text-sm leading-tight mb-1 truncate">{item.name}</h3>
                                            <p className="text-[10px] text-muted-foreground font-mono">{item.code}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 2 && (
                            <div className="space-y-4">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Select Component Items (SFG/RM)</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-1">
                                    {ALL_ITEMS.filter(i => i.type !== "FG").map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleComponent(item)}
                                            onMouseMove={(e) => {
                                                setHoveredItem(item);
                                                setMousePos({ x: e.clientX, y: e.clientY });
                                            }}
                                            onMouseLeave={() => setHoveredItem(null)}
                                            className={cn(
                                                "relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md",
                                                selectedComponents.some(c => c.id === item.id)
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-muted hover:border-muted-foreground/30"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant={item.type === "SFG" ? "secondary" : "outline"} className="text-[10px] h-5 px-1.5 uppercase font-bold tracking-wider">{item.type}</Badge>
                                                {selectedComponents.some(c => c.id === item.id) && (
                                                    <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                                                        <Check className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="font-semibold text-sm leading-tight mb-1 truncate">{item.name}</h3>
                                            <p className="text-[10px] text-muted-foreground font-mono">{item.code}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 3 && (
                            <div className="space-y-6">
                                <div className="p-4 bg-muted/30 rounded-lg border">
                                    <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Creating BOM for:</p>
                                    <div className="flex items-center gap-3">
                                        <Badge>{selectedMainItem?.type}</Badge>
                                        <span className="font-semibold">{selectedMainItem?.name}</span>
                                        <span className="text-muted-foreground">({selectedMainItem?.code})</span>
                                    </div>
                                </div>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Component Item</TableHead>
                                                <TableHead>UOM</TableHead>
                                                <TableHead className="w-[200px]">Quantity</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedComponents.map((comp) => (
                                                <TableRow key={comp.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{comp.name}</span>
                                                            <span className="text-xs text-muted-foreground">{comp.code}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{comp.uom}</TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <Input
                                                                type="number"
                                                                placeholder="Enter Qty"
                                                                value={quantities[comp.id] || ""}
                                                                onChange={(e) => handleQuantityChange(comp.id, e.target.value)}
                                                                className={cn(errors[comp.id] && "border-red-500 focus-visible:ring-red-500")}
                                                            />
                                                            {errors[comp.id] && (
                                                                <p className="text-[10px] text-red-500 font-medium">{errors[comp.id]}</p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <div className="p-6 border-t bg-muted/10 flex justify-between">
                        <Button
                            variant="outline"
                            onClick={() => activeTab > 1 ? setActiveTab(prev => prev - 1) : setLocation("/production/bom")}
                        >
                            {activeTab === 1 ? "Cancel" : "Back"}
                        </Button>
                        <Button
                            onClick={() => {
                                if (activeTab === 1) {
                                    if (!selectedMainItem) toast({ title: "Selection Required", description: "Please select an item to continue", variant: "destructive" });
                                    else setActiveTab(2);
                                } else if (activeTab === 2) {
                                    if (selectedComponents.length === 0) toast({ title: "Selection Required", description: "Please select components to continue", variant: "destructive" });
                                    else setActiveTab(3);
                                } else {
                                    handleSaveBOM();
                                }
                            }}
                        >
                            {activeTab === 3 ? "Save BOM" : "Next"}
                        </Button>
                    </div>
                </Card>
            </div >
        );
    }

    // ============================================================================
    // RENDER - LISTING PAGE
    // ============================================================================

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <h1 className="text-3xl font-bold tracking-tight">
                Bill of Materials
            </h1>

            {/* Search Section with Filter and Create Button - Matching MaterialOperation */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by BOM Code, Name or Item..."
                            className="pl-9 h-10"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>
                <div className="w-full sm:w-64">
                    <SearchableSelect
                        label="Type"
                        value={typeFilter}
                        options={["All", "FG", "SFG"]}
                        onChange={(value) => {
                            setTypeFilter(value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <div className="w-full sm:w-auto">
                    <Button onClick={handleCreateBOM} className="w-full sm:w-auto h-10">
                        <Plus className="mr-2 h-4 w-4" />
                        Create BOM
                    </Button>
                </div>
            </div>

            {/* Listing Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">BOM Code</TableHead>
                                    <TableHead className="font-semibold">BOM Name</TableHead>
                                    <TableHead className="font-semibold">FG / SFG</TableHead>
                                    <TableHead className="font-semibold">Created On</TableHead>
                                    <TableHead className="text-right font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((item) => (
                                        <TableRow key={item.id} className="group hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-medium font-mono">
                                                {item.bomCode}
                                            </TableCell>
                                            <TableCell className="font-semibold">{item.bomName}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant={item.itemType === 'FG' ? "default" : "secondary"}
                                                        className={cn(
                                                            "px-2",
                                                            item.itemType === 'FG' ? "bg-green-500 hover:bg-green-600" : "bg-purple-500 text-white hover:bg-purple-600"
                                                        )}
                                                    >
                                                        {item.itemType}
                                                    </Badge>
                                                    <span className="text-sm font-medium text-muted-foreground">{item.itemName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(item.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleViewBOM(item.id)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleEditBOM(item.id)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No BOM records found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination - Matching MaterialOperation */}
                    {filteredData.length > 0 && (
                        <div className="flex justify-between items-center px-1 mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-medium">{filteredData.length}</span> entries
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage >= totalPages || totalPages === 0}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View/Edit BOM Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            {dialogMode === "view" ? <Eye className="h-6 w-6 text-primary" /> : <Pencil className="h-6 w-6 text-primary" />}
                            {dialogMode === "view" ? "View BOM Details" : "Edit BOM Details"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialogMode === "view"
                                ? "Review the specific components and quantities for this Bill of Material."
                                : "Modify the component quantities for this record."}
                        </DialogDescription>
                    </DialogHeader>

                    {currentRecord && (
                        <div className="flex-1 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">BOM Code</p>
                                    <p className="font-mono text-sm">{currentRecord.bomCode}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">BOM Name</p>
                                    {dialogMode === "view" ? (
                                        <p className="text-sm font-semibold">{currentRecord.bomName}</p>
                                    ) : (
                                        <Input
                                            value={dialogBomName}
                                            onChange={(e) => setDialogBomName(e.target.value)}
                                            className="h-8 text-sm bg-background font-semibold"
                                        />
                                    )}
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Main Item</p>
                                    <p className="text-sm">{currentRecord.itemName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Type</p>
                                    <Badge>{currentRecord.itemType}</Badge>
                                </div>

                                <div className="col-span-2 lg:col-span-4 pt-3 border-t border-muted/50">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                        Description / Technical Notes
                                    </p>
                                    {dialogMode === "view" ? (
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {currentRecord.description || "No description provided."}
                                        </p>
                                    ) : (
                                        <Input
                                            value={dialogDescription}
                                            onChange={(e) => setDialogDescription(e.target.value)}
                                            placeholder="Add description..."
                                            className="bg-background text-sm h-9"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Component Item</TableHead>
                                            <TableHead>UOM</TableHead>
                                            <TableHead className="w-[180px]">Quantity</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[301, 302].map((id) => {
                                            const item = ALL_ITEMS.find(i => i.id === id);
                                            return item ? (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">{item.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{item.code}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{item.uom}</TableCell>
                                                    <TableCell>
                                                        {dialogMode === "view" ? (
                                                            <span className="font-medium">{dialogQuantities[item.id]}</span>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                <Input
                                                                    type="number"
                                                                    value={dialogQuantities[item.id] || ""}
                                                                    onChange={(e) => handleDialogQuantityChange(item.id, e.target.value)}
                                                                    className={cn("h-8 text-sm", dialogErrors[item.id] && "border-red-500")}
                                                                />
                                                                {dialogErrors[item.id] && <p className="text-[10px] text-red-500 font-medium">{dialogErrors[item.id]}</p>}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ) : null;
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-6 border-t pt-4 flex items-center justify-between sm:justify-between w-full">
                        <div className="flex gap-2">
                            {dialogMode === "edit" && (
                                <Button
                                    variant="destructive"
                                    onClick={handleDeleteFromDialog}
                                    className="h-9 px-4 text-xs font-bold uppercase tracking-wider"
                                >
                                    Delete BOM
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {dialogMode === "view" ? "Close" : "Cancel"}
                            </Button>
                            {dialogMode === "edit" && (
                                <Button onClick={handleSaveFromDialog}>
                                    Save Changes
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
