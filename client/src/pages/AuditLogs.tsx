import * as React from "react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppListToolbar, FilterField } from "@/components/shared/AppListToolbar";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { format } from "date-fns";

// --- Types & Interfaces ---

interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  module: string;
  submodule: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  oldValue: string | null;
  newValue: string | null;
}

// --- Mock Data ---

const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    timestamp: "2026-05-15T10:30:00Z",
    user: "Admin User",
    module: "Inventory",
    submodule: "Materials",
    action: "UPDATE",
    oldValue: 'price: 100',
    newValue: 'price: 120',
  },
  {
    id: 2,
    timestamp: "2026-05-15T10:30:00Z",
    user: "Admin User",
    module: "Inventory",
    submodule: "Materials",
    action: "UPDATE",
    oldValue: 'status: Active',
    newValue: 'status: Inactive',
  },
  {
    id: 3,
    timestamp: "2026-05-15T11:15:00Z",
    user: "John Doe",
    module: "HRMS",
    submodule: "Core HR",
    action: "CREATE",
    oldValue: null,
    newValue: 'name: Alice Smith',
  },
  {
    id: 4,
    timestamp: "2026-05-15T11:15:00Z",
    user: "John Doe",
    module: "HRMS",
    submodule: "Core HR",
    action: "CREATE",
    oldValue: null,
    newValue: 'role: Developer',
  },
];

const ActionBadge = ({ action }: { action: AuditLog["action"] }) => {
  switch (action) {
    case "CREATE":
      return <Badge className="bg-green-500 hover:bg-green-600">CREATE</Badge>;
    case "UPDATE":
      return <Badge className="bg-blue-500 hover:bg-blue-600">UPDATE</Badge>;
    case "DELETE":
      return <Badge variant="destructive">DELETE</Badge>;
    default:
      return <Badge variant="secondary">{action}</Badge>;
  }
};

export default function AuditLogs() {
  const { isMenuVisible } = useHasPermission();
  const permissionModule = "SYSTEM/AUDIT_LOGS";

  // Access check
  if (!isMenuVisible(permissionModule) && !isMenuVisible("SYSTEM/ROLES_PERMISSIONS")) {
    // For now, if someone can see roles & permissions, they can see audit logs
    // unless you want a strict gate. 
  }

  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter logic for mock data
  const filteredLogs = mockAuditLogs.filter((log) => {
    const matchesSearch = 
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.submodule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const logDate = new Date(log.timestamp);
    const matchesFromDate = !fromDate || logDate >= fromDate;
    const matchesToDate = !toDate || logDate <= toDate;

    return matchesSearch && matchesFromDate && matchesToDate;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const filterFields: FilterField[] = [
    {
      type: "date",
      label: "From Date",
      value: fromDate,
      onChange: setFromDate,
      placeholder: "Select from date",
      showClear: true,
    },
    {
      type: "date",
      label: "To Date",
      value: toDate,
      onChange: setToDate,
      placeholder: "Select to date",
      showClear: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          Track system-wide activity and record changes.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AppListToolbar
            search={{
              value: searchTerm,
              onChange: setSearchTerm,
              placeholder: "Search user, module, action...",
            }}
            filters={filterFields}
          />

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Timestamp</TableHead>
                  <TableHead className="font-bold">User/Employee</TableHead>
                  <TableHead className="font-bold">Module/Submodule</TableHead>
                  <TableHead className="font-bold text-center">Action</TableHead>
                  <TableHead className="font-bold">Old Value</TableHead>
                  <TableHead className="font-bold">New Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        {format(new Date(log.timestamp), "dd MMM yyyy, hh:mm a")}
                      </TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{log.module}</span>
                          <span className="text-xs text-muted-foreground">{log.submodule}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <ActionBadge action={log.action} />
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {log.oldValue ? (
                          <div className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded border border-dashed truncate">
                            {log.oldValue}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">None</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {log.newValue ? (
                          <div className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded border border-dashed truncate">
                            {log.newValue}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No audit logs found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={filteredLogs.length}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
