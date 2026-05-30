import React, { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { holidayApi } from "@/lib/api";
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
import { Plus, Search, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Edit, ChevronsUpDown, Check, ChevronDown, Loader2 } from "lucide-react";
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
import { useCommonStore } from "@/store/commonStore";
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/lib/store";

/** Green styling for successful create / update / delete; use `variant: "destructive"` for validation & errors. */
const crudSuccessToast = {
  className:
    "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";

export default function Holiday() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isMenuVisible, canCreate, canEdit, canDelete: canDeletePermission } = useHasPermission();

  const hasAccess = isMenuVisible("HRMS:Holiday");

  // Early return if no access at all
  if (!hasAccess) {
    return <Unauthorized />;
  }

  // Pagination & search state
  const [holidaySearchQuery, setHolidaySearchQuery] = useState("");
  const debouncedHolidaySearchQuery = useDebounce(holidaySearchQuery, 500);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal state
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [holidayFormData, setHolidayFormData] = useState({
    holidayName: "",
    holidayDate: undefined as Date | undefined,
    status: "Active"
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [holidayToDeleteID, setHolidayToDeleteID] = useState<string | null>(null);

  // Fetch holidays from API
  const { data: holidayApiData, isLoading: isListLoading, isError } = useQuery({
    queryKey: ["holidays", currentPage, itemsPerPage, debouncedHolidaySearchQuery, selectedYear],
    queryFn: () => holidayApi.getList({
      page: currentPage,
      limit: itemsPerPage,
      search: debouncedHolidaySearchQuery || undefined,
      year: selectedYear
    }),
    staleTime: 30_000,
  });

  const apiRecords = holidayApiData?.data?.records || [];
  const pagination = holidayApiData?.data?.pagination;

  // Map API records to display shape
  const holidays = apiRecords.map(r => ({
    id: String(r.id),
    numericId: r.id,
    company_id: r.company_id,
    holidayName: r.holiday_name,
    holidayDate: r.holiday_date,
    day: r.holiday_date ? new Date(r.holiday_date).toLocaleDateString('en-US', { weekday: 'long' }) : "",
    status: r.status ? "Active" : "Inactive",
  }));

  // The API now handles server-side filtering by year
  const filteredHolidays = holidays;

  // Get company_id from localStorage user, or fall back to company_id from loaded records
  // Master data for fallback discovery (lookup company context)
  const departments = useCommonStore(state => state.departments);
  const locations = useCommonStore(state => state.locations);

  const shifts = useCommonStore(state => state.shifts);
  const employmentTypes = useCommonStore(state => state.employmentTypes);


  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof holidayApi.create>[0]) => holidayApi.create(data),
    onSuccess: (result) => {
      if (result.isSuccessful) {
        queryClient.invalidateQueries({ queryKey: ["holidays"] });
        setIsHolidayModalOpen(false);
        toast({
          ...crudSuccessToast,
          title: "Holiday Added",
          description: "The holiday has been added.",
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof holidayApi.update>[0]) => holidayApi.update(data),
    onSuccess: (result) => {
      if (result.isSuccessful) {
        queryClient.invalidateQueries({ queryKey: ["holidays"] });
        setIsHolidayModalOpen(false);
        toast({
          ...crudSuccessToast,
          title: "Holiday Updated",
          description: "The holiday has been updated.",
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => holidayApi.delete(id),
    onSuccess: (result) => {
      if (result.isSuccessful) {
        queryClient.invalidateQueries({ queryKey: ["holidays"] });
        toast({
          ...crudSuccessToast,
          title: "Holiday Deleted",
          description: "The holiday has been removed.",
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
      setIsDeleteDialogOpen(false);
      setHolidayToDeleteID(null);
      setIsHolidayModalOpen(false);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
      setIsDeleteDialogOpen(false);
      setHolidayToDeleteID(null);
    },
  });

  const handleDeleteClick = (id: string) => {
    setHolidayToDeleteID(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!holidayToDeleteID) return;
    // Find the numeric id from the holidays list
    const holiday = holidays.find(h => h.id === holidayToDeleteID);
    if (holiday) {
      deleteMutation.mutate(holiday.numericId);
    } else {
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

  const handleSave = () => {
    // Validation
    if (!holidayFormData.holidayName || !holidayFormData.holidayDate) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please fill in all required fields." });
      return;
    }

    const dateStr = format(holidayFormData.holidayDate, 'yyyy-MM-dd');
    const statusBool = holidayFormData.status === "Active";
    let companyId = user?.companyId;
    
    // Robust fallback: if state is missing, try to recover from localStorage directly
    if (!companyId) {
      try {
        const savedUser = localStorage.getItem('auth_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          companyId = parsed.companyId || parsed.company_id || parsed.id;
          console.log("🔄 Holiday: Recovered companyId from localStorage:", companyId);
        }
      } catch (err) {
        console.error("❌ Holiday: Failed to recover companyId from storage", err);
      }
    }

    if (!companyId) {
      console.error("❌ Holiday creation failed: companyId is missing from user object", user);
      toast({ variant: "destructive", title: "Error", description: "Company not found. Please log out and log in again." });
      return;
    }

    if (editingHoliday) {
      const updatePayload = {
        id: editingHoliday.numericId,
        company_id: editingHoliday.company_id || companyId,
        holiday_name: holidayFormData.holidayName,
        holiday_date: dateStr,
        status: statusBool,
      };
      // console.log("📤 UPDATE Payload being sent to API:", JSON.stringify(updatePayload, null, 2));
      updateMutation.mutate(updatePayload);
    } else {
      const createPayload = {
        company_id: companyId,
        holiday_name: holidayFormData.holidayName,
        holiday_date: dateStr,
        status: statusBool,
      };
      // console.log("📤 CREATE Payload being sent to API:", JSON.stringify(createPayload, null, 2));
      createMutation.mutate(createPayload);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Holiday Management</h1>
        <p className="text-muted-foreground text-sm">Manage organizational holidays and office closures.</p>
      </div>

      <AppListToolbar
        search={{
          value: holidaySearchQuery,
          onChange: (val) => { setHolidaySearchQuery(val); setCurrentPage(1); },
          placeholder: "Search holidays..."
        }}
        filters={[
          {
            type: 'year',
            label: 'Year',
            value: selectedYear,
            onChange: (year) => {
              setSelectedYear(year || new Date().getFullYear());
              setCurrentPage(1);
            },
            showClear: selectedYear !== new Date().getFullYear()
          }
        ]}
        actions={canCreate("HRMS:Holiday") ? [
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
        ] : []}
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
                {isListLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-red-500">Failed to load holidays.</TableCell></TableRow>
                ) : filteredHolidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                      No holidays found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHolidays.map((holiday) => (
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
                          onEdit={canEdit("HRMS:Holiday") ? () => {
                            setEditingHoliday(holiday);
                            setHolidayFormData({
                              holidayName: holiday.holidayName,
                              holidayDate: new Date(holiday.holidayDate),
                              status: holiday.status as "Active" | "Inactive"
                            });
                            setIsHolidayModalOpen(true);
                          } : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isListLoading && pagination && pagination.totalCount > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Holiday Modal */}
      <Dialog open={isHolidayModalOpen} onOpenChange={setIsHolidayModalOpen}>
        <DialogContent className="w-[95%] sm:max-w-xl md:max-w-2xl lg:max-w-3xl md:min-h-[52vh] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2 pb-2">
            <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
            <DialogDescription>
              {editingHoliday ? "Update the holiday details" : "Add a new holiday to the calendar"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div className="space-y-3">
              <Label>Holiday Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Christmas Day"
                value={holidayFormData.holidayName}
                onChange={(e) => setHolidayFormData(prev => ({ ...prev, holidayName: e.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <Label>Date <span className="text-red-500">*</span></Label>
              <DatePicker
                date={holidayFormData.holidayDate}
                setDate={(date) => setHolidayFormData(prev => ({ ...prev, holidayDate: date }))}
                showClear={false}
              />
            </div>

            <div className="space-y-3">
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

          <DialogFooter className={cn("mt-2 border-t pt-5", editingHoliday ? "sm:justify-between" : "sm:justify-end")}>
            {editingHoliday && canDeletePermission("HRMS:Holiday") && (
              <Button
                variant="destructive"
                loading={deleteMutation.isPending}
                onClick={() => handleDeleteClick(editingHoliday.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsHolidayModalOpen(false)}>Cancel</Button>
              <Button
                loading={createMutation.isPending || updateMutation.isPending}
                disabled={!holidayFormData.holidayName || !holidayFormData.holidayDate}
                onClick={handleSave}
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
              loading={deleteMutation.isPending}
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
