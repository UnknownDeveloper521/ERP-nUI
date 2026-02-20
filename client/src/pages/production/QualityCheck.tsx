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
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QualityCheckRecord {
  id: string;
  batch: string;
  product: string;
  sampleSize: number;
  passed: number;
  failed: number;
  result: "Pass" | "Fail";
  inspector: string;
  date: string;
}

export default function QualityCheck() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sample data
  const [records] = useState<QualityCheckRecord[]>([
    { id: "QC-001", batch: "B-0106-A", product: "Motor Assembly A", sampleSize: 50, passed: 49, failed: 1, result: "Pass", inspector: "Mike Johnson", date: "2024-01-15" },
    { id: "QC-002", batch: "B-0106-B", product: "Pump Unit B", sampleSize: 30, passed: 30, failed: 0, result: "Pass", inspector: "Sarah Williams", date: "2024-01-15" },
    { id: "QC-003", batch: "B-0105-C", product: "Control Panel C", sampleSize: 20, passed: 16, failed: 4, result: "Fail", inspector: "Mike Johnson", date: "2024-01-14" },
    { id: "QC-004", batch: "B-0105-D", product: "Valve Assembly D", sampleSize: 40, passed: 40, failed: 0, result: "Pass", inspector: "Sarah Williams", date: "2024-01-14" },
    { id: "QC-005", batch: "B-0104-E", product: "Sensor Module E", sampleSize: 25, passed: 24, failed: 1, result: "Pass", inspector: "Mike Johnson", date: "2024-01-13" },
  ]);

  // Filter data
  const filteredRecords = records.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedData = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Quality Check</h1>
        <p className="text-muted-foreground">
          Manage quality inspection records and test results.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="w-full sm:w-1/2">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quality checks..."
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
          <Button data-testid="button-new-qc">
            <Plus className="mr-2 h-4 w-4" />
            New QC Entry
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Quality Check Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>QC ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Sample Size</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Inspector</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No quality check records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium font-mono">{record.id}</TableCell>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>{record.batch}</TableCell>
                      <TableCell>{record.product}</TableCell>
                      <TableCell className="text-right">{record.sampleSize}</TableCell>
                      <TableCell className="text-right text-green-600">{record.passed}</TableCell>
                      <TableCell className="text-right text-red-600">{record.failed}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={record.result === "Pass" ? "default" : "destructive"}
                          className="inline-flex items-center gap-1"
                        >
                          {record.result === "Pass" ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {record.result}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.inspector}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredRecords.length > 0 && (
            <div className="flex justify-between items-center px-1 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} entries
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
    </div>
  );
}
