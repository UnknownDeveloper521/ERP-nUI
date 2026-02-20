import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MaterialRelease {
  id: number;
  releaseNo: string;
  date: string;
  productionOrder: string;
  department: string;
  requestedBy: string;
  status: "Pending" | "Approved" | "Released" | "Rejected";
  items: ReleaseItem[];
}

interface ReleaseItem {
  id: number;
  materialCode: string;
  materialName: string;
  requestedQty: number;
  releasedQty: number;
  unit: string;
}

export default function MaterialRelease() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<MaterialRelease | null>(null);
  const itemsPerPage = 10;

  // Sample data
  const [releases, setReleases] = useState<MaterialRelease[]>([
    {
      id: 1,
      releaseNo: "MR-2024-001",
      date: "2024-01-15",
      productionOrder: "PO-2024-101",
      department: "Fabrication",
      requestedBy: "John Doe",
      status: "Released",
      items: [
        { id: 1, materialCode: "MAT001", materialName: "Steel Sheet", requestedQty: 100, releasedQty: 100, unit: "KG" },
        { id: 2, materialCode: "MAT002", materialName: "Aluminum Rod", requestedQty: 50, releasedQty: 50, unit: "KG" },
      ]
    },
    {
      id: 2,
      releaseNo: "MR-2024-002",
      date: "2024-01-16",
      productionOrder: "PO-2024-102",
      department: "Assembly",
      requestedBy: "Jane Smith",
      status: "Approved",
      items: [
        { id: 3, materialCode: "MAT003", materialName: "Copper Wire", requestedQty: 200, releasedQty: 0, unit: "MTR" },
      ]
    },
    {
      id: 3,
      releaseNo: "MR-2024-003",
      date: "2024-01-17",
      productionOrder: "PO-2024-103",
      department: "Finishing",
      requestedBy: "Mike Johnson",
      status: "Pending",
      items: [
        { id: 4, materialCode: "MAT004", materialName: "Paint", requestedQty: 20, releasedQty: 0, unit: "LTR" },
      ]
    },
  ]);

  // Filter data
  const filteredReleases = releases.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Pagination
  const totalPages = Math.ceil(filteredReleases.length / itemsPerPage);
  const paginatedData = filteredReleases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleViewDetails = (release: MaterialRelease) => {
    setSelectedRelease(release);
    setIsDialogOpen(true);
  };

  const handleStatusChange = (id: number, newStatus: MaterialRelease["status"]) => {
    setReleases(releases.map(r => r.id === id ? { ...r, status: newStatus } : r));
    toast({ title: "Success", description: `Status updated to ${newStatus}` });
  };

  const getStatusColor = (status: MaterialRelease["status"]) => {
    switch (status) {
      case "Released": return "default";
      case "Approved": return "default";
      case "Pending": return "secondary";
      case "Rejected": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Material Release</h1>
        <p className="text-muted-foreground">
          Manage material release requests for production orders.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="w-full sm:w-1/2">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search releases..."
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
        <div className="w-full sm:w-auto ml-auto mt-auto pt-5">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Release Request
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Material Release Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Release No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Production Order</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No release requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((release) => (
                    <TableRow key={release.id}>
                      <TableCell className="font-medium">{release.releaseNo}</TableCell>
                      <TableCell>{release.date}</TableCell>
                      <TableCell>{release.productionOrder}</TableCell>
                      <TableCell>{release.department}</TableCell>
                      <TableCell>{release.requestedBy}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(release.status)}>
                          {release.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-muted"
                            onClick={() => handleViewDetails(release)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {release.status === "Pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-green-600 hover:bg-green-50"
                                onClick={() => handleStatusChange(release.id, "Approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-red-600 hover:bg-red-50"
                                onClick={() => handleStatusChange(release.id, "Rejected")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {release.status === "Approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-blue-600 hover:bg-blue-50"
                              onClick={() => handleStatusChange(release.id, "Released")}
                            >
                              Release
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredReleases.length > 0 && (
            <div className="flex justify-between items-center px-1 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredReleases.length)} of {filteredReleases.length} entries
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
                  disabled={currentPage >= totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Material Release Details</DialogTitle>
            <DialogDescription>
              View details of material release request
            </DialogDescription>
          </DialogHeader>
          {selectedRelease && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Release No</Label>
                  <p className="font-medium">{selectedRelease.releaseNo}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">{selectedRelease.date}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Production Order</Label>
                  <p className="font-medium">{selectedRelease.productionOrder}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <p className="font-medium">{selectedRelease.department}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Requested By</Label>
                  <p className="font-medium">{selectedRelease.requestedBy}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant={getStatusColor(selectedRelease.status)}>
                    {selectedRelease.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">Materials</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Material Code</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead>Requested Qty</TableHead>
                        <TableHead>Released Qty</TableHead>
                        <TableHead>Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRelease.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.materialCode}</TableCell>
                          <TableCell>{item.materialName}</TableCell>
                          <TableCell>{item.requestedQty}</TableCell>
                          <TableCell>{item.releasedQty}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
