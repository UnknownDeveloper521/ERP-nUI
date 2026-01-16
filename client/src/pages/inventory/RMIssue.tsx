import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Plus, Search, Loader2, ArrowUpDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type MaterialType = "ROLL" | "PACKAGING";

interface RollMaterial {
  id: string;
  name: string;
  weight_kg: number;
}

interface PackagingMaterial {
  id: string;
  name: string;
  weight_per_unit: number | null;
}

interface ReceiptRef {
  id: string;
  receipt_no: string;
  material_type: MaterialType | null;
  roll_material_id: string | null;
  packaging_material_id: string | null;
  warehouse_location: string | null;
  unit_cost: number;
  raw_material_roll_master?: RollMaterial;
  packaging_material_master?: PackagingMaterial;
}

interface MachineRef {
  id: string;
  name: string;
}

interface BatchRef {
  id: string;
  batch_no: string;
}

interface RmIssue {
  id: string;
  issue_no: string;
  receipt_id: string;
  material_type: MaterialType | null;
  roll_material_id: string | null;
  packaging_material_id: string | null;
  warehouse_location: string;
  machine_id: string | null;
  batch_id: string | null;
  issued_qty: number;
  issued_cost: number | null;
  issued_date: string;
  issued_by?: string | null;
  created_at: string;
  raw_material_receipts?: ReceiptRef;
  machine_master?: MachineRef;
  raw_material_roll_master?: RollMaterial;
  packaging_material_master?: PackagingMaterial;
  production_batches?: BatchRef;
}

interface IssueFormData {
  issue_no: string;
  receipt_id: string;
  machine_id: string;
  batch_id: string;
  warehouse_location: string;
  issued_date: string;
  issued_qty: string;
}

const NONE_MACHINE_VALUE = "__none__";

const initialFormData: IssueFormData = {
  issue_no: "",
  receipt_id: "",
  machine_id: NONE_MACHINE_VALUE,
  batch_id: "",
  warehouse_location: "MAIN",
  issued_date: new Date().toISOString().split("T")[0],
  issued_qty: "",
};

export default function RMIssue() {
  const { toast } = useToast();
  const [issues, setIssues] = useState<RmIssue[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRef[]>([]);
  const [rollMaterials, setRollMaterials] = useState<RollMaterial[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterial[]>([]);
  const [machines, setMachines] = useState<MachineRef[]>([]);
  const [batches, setBatches] = useState<BatchRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<IssueFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedMaterialUom, setSelectedMaterialUom] = useState("");
  const [selectedReceiptMaterial, setSelectedReceiptMaterial] = useState<{
    material_type: MaterialType | null;
    roll_material_id: string | null;
    packaging_material_id: string | null;
    warehouse_location: string | null;
  }>({ material_type: null, roll_material_id: null, packaging_material_id: null, warehouse_location: null });
  const [availableQty, setAvailableQty] = useState<number | null>(null);

  useEffect(() => {
    fetchIssues();
    fetchReceipts();
    fetchRollMaterials();
    fetchPackagingMaterials();
    fetchMachines();
    fetchBatches();
  }, []);

  useEffect(() => {
    if (!formData.receipt_id) return;
    if (!selectedReceiptMaterial.material_type) return;

    const mat = {
      material_type: selectedReceiptMaterial.material_type,
      roll_material_id: selectedReceiptMaterial.roll_material_id,
      packaging_material_id: selectedReceiptMaterial.packaging_material_id,
      warehouse_location: (formData.warehouse_location || "").trim() || null,
    };

    fetchAvailableQty(mat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.warehouse_location]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("raw_material_issues")
        .select(
          `
          *,
          raw_material_receipts (
            id,
            receipt_no,
            material_type,
            roll_material_id,
            packaging_material_id,
            unit_cost,
            raw_material_roll_master ( id, name, weight_kg ),
            packaging_material_master ( id, name, weight_per_unit )
          ),
          raw_material_roll_master ( id, name, weight_kg ),
          packaging_material_master ( id, name, weight_per_unit ),
          machine_master ( id, name ),
          production_batches ( id, batch_no )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIssues((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading issues",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase
        .from("machine_master")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setMachines((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading machines",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from("production_batches")
        .select("id, batch_no")
        .order("batch_no", { ascending: false });

      if (error) throw error;
      setBatches((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading batches",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchRollMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("raw_material_roll_master")
        .select("id, name, weight_kg")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRollMaterials((data as any) || []);
    } catch (error: any) {
      toast({ title: "Error loading roll materials", description: error.message, variant: "destructive" });
    }
  };

  const fetchPackagingMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("packaging_material_master")
        .select("id, name, weight_per_unit")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPackagingMaterials((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading packaging materials",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from("raw_material_receipts")
        .select(
          `
          id,
          receipt_no,
          material_type,
          roll_material_id,
          packaging_material_id,
          warehouse_location,
          unit_cost,
          raw_material_roll_master ( id, name, weight_kg ),
          packaging_material_master ( id, name, weight_per_unit )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReceipts((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading receipts",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateIssueNo = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `RMI-${year}${month}${day}-${random}`;
  };

  const openNewIssueDialog = () => {
    setFormData({
      ...initialFormData,
      issue_no: generateIssueNo(),
      issued_date: new Date().toISOString().split("T")[0],
    });
    setSelectedMaterialUom("");
    setSelectedReceiptMaterial({
      material_type: null,
      roll_material_id: null,
      packaging_material_id: null,
      warehouse_location: null,
    });
    setAvailableQty(null);
    setDialogOpen(true);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const fetchAvailableQty = async (m: {
    material_type: MaterialType | null;
    roll_material_id: string | null;
    packaging_material_id: string | null;
    warehouse_location: string | null;
  }) => {
    setAvailableQty(null);
    if (!m.material_type) return;
    if (m.material_type === "ROLL" && !m.roll_material_id) return;
    if (m.material_type === "PACKAGING" && !m.packaging_material_id) return;
    if (!m.warehouse_location || !m.warehouse_location.trim()) return;

    try {
      const materialKey = m.material_type === "ROLL" ? m.roll_material_id : m.packaging_material_id;
      const { data, error } = await supabase
        .from("raw_material_stock")
        .select("available_qty")
        .eq("material_type", m.material_type)
        .eq("material_key", materialKey)
        .eq("warehouse_location", m.warehouse_location);

      if (error) throw error;

      const qty = (data as any)?.[0]?.available_qty;
      setAvailableQty(qty === null || qty === undefined ? 0 : Number(qty));
    } catch {
      setAvailableQty(null);
    }
  };

  const handleReceiptChange = async (receiptId: string) => {
    setFormData((prev) => ({ ...prev, receipt_id: receiptId }));
    const receipt = receipts.find((r) => r.id === receiptId);

    const whLoc = (receipt?.warehouse_location || formData.warehouse_location || "MAIN").trim();

    const mat = {
      material_type: receipt?.material_type || null,
      roll_material_id: receipt?.roll_material_id || null,
      packaging_material_id: receipt?.packaging_material_id || null,
      warehouse_location: whLoc || null,
    };
    setSelectedReceiptMaterial(mat);

    setFormData((prev) => ({
      ...prev,
      warehouse_location: whLoc,
    }));

    const uom = mat.material_type === "PACKAGING" ? "UNITS" : "KG";
    setSelectedMaterialUom(uom);

    await fetchAvailableQty({ ...mat, warehouse_location: whLoc });
  };

  const filteredIssues = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return issues
      .filter((issue) => {
        const materialName =
          issue.material_type === "PACKAGING"
            ? issue.packaging_material_master?.name ||
              issue.raw_material_receipts?.packaging_material_master?.name ||
              ""
            : issue.raw_material_roll_master?.name ||
              issue.raw_material_receipts?.raw_material_roll_master?.name ||
              "";

        const matchesSearch =
          (issue.issue_no || "").toLowerCase().includes(searchLower) ||
          materialName.toLowerCase().includes(searchLower) ||
          (issue.production_batches?.batch_no || "").toLowerCase().includes(searchLower) ||
          (issue.machine_master?.name || "").toLowerCase().includes(searchLower);

        const filterKey =
          issue.material_type === "PACKAGING"
            ? `PACKAGING:${issue.packaging_material_id || ""}`
            : `ROLL:${issue.roll_material_id || ""}`;

        const matchesMaterial = materialFilter === "all" || filterKey === materialFilter;

        return matchesSearch && matchesMaterial;
      })
      .sort((a, b) => {
        const dateA = new Date(a.issued_date).getTime();
        const dateB = new Date(b.issued_date).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
  }, [issues, searchTerm, materialFilter, sortOrder]);

  const validateForm = (): boolean => {
    if (!formData.issue_no) {
      toast({ title: "Issue number is required", variant: "destructive" });
      return false;
    }
    if (!formData.receipt_id) {
      toast({ title: "Please select a receipt", variant: "destructive" });
      return false;
    }
    if (!selectedReceiptMaterial.material_type) {
      toast({ title: "Receipt does not have a material type", variant: "destructive" });
      return false;
    }
    if (selectedReceiptMaterial.material_type === "ROLL" && !selectedReceiptMaterial.roll_material_id) {
      toast({ title: "Receipt does not have a roll material", variant: "destructive" });
      return false;
    }
    if (
      selectedReceiptMaterial.material_type === "PACKAGING" &&
      !selectedReceiptMaterial.packaging_material_id
    ) {
      toast({ title: "Receipt does not have a packaging material", variant: "destructive" });
      return false;
    }

    if (!formData.batch_id) {
      toast({ title: "Production batch is required", variant: "destructive" });
      return false;
    }
    if (!formData.warehouse_location || !formData.warehouse_location.trim()) {
      toast({ title: "Warehouse location is required", variant: "destructive" });
      return false;
    }
    if (!formData.issued_date) {
      toast({ title: "Issued date is required", variant: "destructive" });
      return false;
    }

    const qty = parseFloat(formData.issued_qty);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Issued quantity must be greater than zero",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const receipt = receipts.find((r) => r.id === formData.receipt_id);
      const matType = receipt?.material_type || selectedReceiptMaterial.material_type;
      const rollId = receipt?.roll_material_id || selectedReceiptMaterial.roll_material_id;
      const packId = receipt?.packaging_material_id || selectedReceiptMaterial.packaging_material_id;

      const issueData = {
        issue_no: formData.issue_no,
        receipt_id: formData.receipt_id,
        material_type: matType,
        roll_material_id: matType === "ROLL" ? rollId : null,
        packaging_material_id: matType === "PACKAGING" ? packId : null,
        warehouse_location: formData.warehouse_location,
        machine_id:
          !formData.machine_id || formData.machine_id === NONE_MACHINE_VALUE
            ? null
            : formData.machine_id,
        batch_id: formData.batch_id,
        issued_date: formData.issued_date,
        issued_qty: parseFloat(formData.issued_qty),
      };

      const { error } = await supabase
        .from("raw_material_issues")
        .insert([issueData]);

      if (error) throw error;

      toast({ title: "Issue created successfully" });
      setDialogOpen(false);
      await fetchIssues();
    } catch (error: any) {
      const msg = String(error?.message || "Error creating issue");
      const friendly = msg.toLowerCase().includes("insufficient stock")
        ? "Insufficient stock for this RM Issue."
        : msg;

      toast({
        title: "Error creating issue",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">
        Inventory
      </h1>
      <ModuleTabs tabs={inventoryTabs} />

      <div className="flex flex-wrap justify-between items-center gap-4 mt-4">
        <h2 className="text-lg font-medium">RM Issue</h2>
        <Button onClick={openNewIssueDialog} data-testid="button-new-issue">
          <Plus className="h-4 w-4 mr-2" />
          New Issue
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-base">Material Issues</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[200px]"
                  data-testid="input-search"
                />
              </div>

              <Select value={materialFilter} onValueChange={setMaterialFilter}>
                <SelectTrigger
                  className="w-[180px]"
                  data-testid="select-material-filter"
                >
                  <SelectValue placeholder="Filter by material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Materials</SelectItem>
                  <SelectItem value="ROLL:__all__" disabled>
                    Rolls
                  </SelectItem>
                  {rollMaterials.map((m) => (
                    <SelectItem key={m.id} value={`ROLL:${m.id}`}>
                      {m.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="PACKAGING:__all__" disabled>
                    Packaging
                  </SelectItem>
                  {packagingMaterials.map((m) => (
                    <SelectItem key={m.id} value={`PACKAGING:${m.id}`}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                data-testid="button-sort"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || materialFilter !== "all"
                ? "No issues match your filters"
                : "No issues found. Click 'New Issue' to add one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Issue No</th>
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Batch</th>
                    <th className="text-left py-2 px-2">Machine</th>
                    <th className="text-left py-2 px-2">Warehouse</th>
                    <th className="text-left py-2 px-2">Material</th>
                    <th className="text-left py-2 px-2">Receipt Ref</th>
                    <th className="text-right py-2 px-2">Issued Qty</th>
                    <th className="text-right py-2 px-2">Issued Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue) => (
                    <tr
                      key={issue.id}
                      className="border-b hover:bg-muted/50"
                      data-testid={`row-issue-${issue.id}`}
                    >
                      <td className="py-2 px-2 font-mono text-primary">
                        {issue.issue_no}
                      </td>
                      <td className="py-2 px-2">{issue.issued_date}</td>
                      <td className="py-2 px-2 font-mono">{issue.production_batches?.batch_no || "-"}</td>
                      <td className="py-2 px-2">{issue.machine_master?.name || "-"}</td>
                      <td className="py-2 px-2">{issue.warehouse_location || "-"}</td>
                      <td className="py-2 px-2">
                        {issue.material_type === "PACKAGING"
                          ? issue.packaging_material_master?.name ||
                            issue.raw_material_receipts?.packaging_material_master?.name ||
                            "Unknown"
                          : issue.raw_material_roll_master?.name ||
                            issue.raw_material_receipts?.raw_material_roll_master?.name ||
                            "Unknown"}
                      </td>
                      <td className="py-2 px-2">
                        {issue.raw_material_receipts?.receipt_no || "-"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {issue.issued_qty} {issue.material_type === "PACKAGING" ? "UNITS" : "KG"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {Number(issue.issued_cost || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New RM Issue</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issue_no">Issue No</Label>
                <Input
                  id="issue_no"
                  name="issue_no"
                  value={formData.issue_no}
                  onChange={handleInputChange}
                  placeholder="RMI-YYYYMMDD-XXX"
                  data-testid="input-issue-no"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issued_date">Issued Date *</Label>
                <Input
                  id="issued_date"
                  name="issued_date"
                  type="date"
                  value={formData.issued_date}
                  onChange={handleInputChange}
                  data-testid="input-issued-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receipt_id">Receipt Reference *</Label>
                <Select
                  value={formData.receipt_id}
                  onValueChange={handleReceiptChange}
                >
                  <SelectTrigger data-testid="select-receipt">
                    <SelectValue placeholder="Select receipt" />
                  </SelectTrigger>
                  <SelectContent>
                    {receipts.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.receipt_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>UOM (Auto-filled)</Label>
                <Input
                  value={selectedMaterialUom}
                  disabled
                  className="bg-muted"
                  data-testid="input-uom"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse_location">Warehouse Location *</Label>
                <Input
                  id="warehouse_location"
                  name="warehouse_location"
                  value={formData.warehouse_location}
                  onChange={handleInputChange}
                  placeholder="e.g. MAIN"
                  data-testid="input-warehouse-location"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Available Stock ({(formData.warehouse_location || "").trim() || "-"})
                </Label>
                <Input
                  value={
                    availableQty === null
                      ? selectedReceiptMaterial.material_type
                        ? "Loading..."
                        : "-"
                      : `${availableQty} ${selectedMaterialUom || ""}`
                  }
                  disabled
                  className="bg-muted"
                  data-testid="input-available-qty"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batch_id">Production Batch *</Label>
                <Select
                  value={formData.batch_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, batch_id: v }))}
                >
                  <SelectTrigger data-testid="select-batch">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.batch_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="machine_id">Machine (Optional)</Label>
                <Select
                  value={formData.machine_id}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, machine_id: v }))
                  }
                >
                  <SelectTrigger data-testid="select-machine">
                    <SelectValue placeholder="Select machine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_MACHINE_VALUE}>None</SelectItem>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issued_qty">Issued Quantity *</Label>
                <Input
                  id="issued_qty"
                  name="issued_qty"
                  type="number"
                  value={formData.issued_qty}
                  onChange={handleInputChange}
                  placeholder="0"
                  data-testid="input-issued-qty"
                />
              </div>
              <div />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              data-testid="button-save"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Create Issue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
