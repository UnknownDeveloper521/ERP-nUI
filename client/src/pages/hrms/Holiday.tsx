import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Edit, ChevronsUpDown, Check, ChevronDown } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import { Command, CommandInputBorderless, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// --- Reusable Searchable Combobox Component (from LeaveManagement) ---
interface SearchableSelectProps {
  label: string;
  value?: string;
  options: string[];
  onChange: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
}



export default function Holiday() {
  const { toast } = useToast();

  // Holiday State
  const [holidays, setHolidays] = useState([
    { id: "hol_001", holidayName: "New Year's Day", holidayDate: "2026-01-01", day: "Thursday", status: "Active" },
    { id: "hol_002", holidayName: "Republic Day", holidayDate: "2026-01-26", day: "Monday", status: "Active" },
    { id: "hol_003", holidayName: "Independence Day", holidayDate: "2026-08-15", day: "Saturday", status: "Active" },
    { id: "hol_004", holidayName: "Gandhi Jayanti", holidayDate: "2026-10-02", day: "Friday", status: "Active" },
    { id: "hol_005", holidayName: "Diwali", holidayDate: "2026-11-01", day: "Sunday", status: "Active" }
  ]);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [holidayFormData, setHolidayFormData] = useState({
    holidayName: "",
    holidayDate: undefined as Date | undefined,
    status: "Active"
  });
  const [holidaySearchQuery, setHolidaySearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [holidayToDeleteID, setHolidayToDeleteID] = useState<string | null>(null);

  const filteredHolidays = holidays.filter((h: any) => {
    const matchesSearch = h.holidayName.toLowerCase().includes(holidaySearchQuery.toLowerCase());
    const matchesYear = !selectedYear || (h.holidayDate ? new Date(h.holidayDate).getFullYear() === selectedYear : false);
    return matchesSearch && matchesYear;
  });

  const totalPages = Math.ceil(filteredHolidays.length / itemsPerPage);
  const paginatedHolidays = filteredHolidays.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDeleteClick = (id: string) => {
    setHolidayToDeleteID(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (holidayToDeleteID) {
      setHolidays((prev: any[]) => prev.filter(h => h.id !== holidayToDeleteID));
      toast({ title: "Holiday Deleted", description: "The holiday has been removed." });
      setIsDeleteDialogOpen(false);
      setHolidayToDeleteID(null);
      setIsHolidayModalOpen(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "—";
      return format(date, 'dd-MM-yyyy');
    } catch {
      return "—";
    }
  };

  const availableYears = Array.from(new Set(
    holidays
      .map(h => h.holidayDate ? new Date(h.holidayDate).getFullYear() : null)
      .filter((y): y is number => y !== null)
  )).sort((a, b) => a - b);

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Holiday Management</h1>
        <p className="text-muted-foreground text-sm">Manage organizational holidays and office closures.</p>
      </div>

      <AppListToolbar
        search={{
          value: holidaySearchQuery,
          onChange: setHolidaySearchQuery,
          placeholder: "Search holidays..."
        }}
        filters={[
          {
            type: 'year',
            label: 'Year',
            value: selectedYear,
            onChange: (year) => setSelectedYear(year || new Date().getFullYear()),
            showClear: selectedYear !== new Date().getFullYear(),
            availableYears: availableYears
          }
        ]}
        actions={[
          {
            label: 'Add Holiday',
            icon: <Plus className="h-4 w-4 mr-2" />,
            onClick: () => {
              setEditingHoliday(null);
              setHolidayFormData({ holidayName: "", holidayDate: undefined, status: "Active" });
              setIsHolidayModalOpen(true);
            },
            variant: 'default'
          }
        ]}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedHolidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                      No holidays found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedHolidays.map((holiday) => (
                    <TableRow key={holiday.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm">{holiday.holidayName}</TableCell>
                      <TableCell className="text-sm">
                        <div>{formatDateTime(holiday.holidayDate)}</div>
                        <div className="text-xs text-muted-foreground">{holiday.day}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={holiday.status === "Active" ? "default" : "secondary"}
                          className={holiday.status === "Active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                        >
                          {holiday.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TableActionButtons
                          onEdit={() => {
                            setEditingHoliday(holiday);
                            setHolidayFormData({
                              holidayName: holiday.holidayName,
                              holidayDate: new Date(holiday.holidayDate),
                              status: holiday.status as "Active" | "Inactive"
                            });
                            setIsHolidayModalOpen(true);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredHolidays.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </CardContent>
      </Card>

      {/* Holiday Modal */}
      <Dialog open={isHolidayModalOpen} onOpenChange={setIsHolidayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
            <DialogDescription>
              {editingHoliday ? "Update the holiday details" : "Add a new holiday to the calendar"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Holiday Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Christmas Day"
                value={holidayFormData.holidayName}
                onChange={(e) => setHolidayFormData(prev => ({ ...prev, holidayName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date <span className="text-red-500">*</span></Label>
              <DatePicker
                date={holidayFormData.holidayDate}
                setDate={(date) => setHolidayFormData(prev => ({ ...prev, holidayDate: date }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={holidayFormData.status}
                onValueChange={(val: any) => setHolidayFormData(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className={cn(editingHoliday ? "sm:justify-between" : "sm:justify-end")}>
            {editingHoliday && (
              <Button
                variant="destructive"
                onClick={() => handleDeleteClick(editingHoliday.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsHolidayModalOpen(false)}>Cancel</Button>
              <Button
                disabled={!holidayFormData.holidayName || !holidayFormData.holidayDate}
                onClick={() => {
                  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                  const newHoliday = {
                    id: editingHoliday ? editingHoliday.id : `hol_${Date.now()}`,
                    holidayName: holidayFormData.holidayName,
                    holidayDate: format(holidayFormData.holidayDate!, 'yyyy-MM-dd'),
                    day: dayNames[holidayFormData.holidayDate!.getDay()],
                    status: holidayFormData.status
                  };

                  if (editingHoliday) {
                    setHolidays((prev: any[]) => prev.map(h => h.id === editingHoliday.id ? newHoliday : h));
                  } else {
                    setHolidays((prev: any[]) => [...prev, newHoliday]);
                  }

                  setIsHolidayModalOpen(false);
                  toast({
                    title: editingHoliday ? "Holiday Updated" : "Holiday Added",
                    description: editingHoliday ? "The holiday has been updated." : "The holiday has been added."
                  });
                }}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHolidayToDeleteID(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
