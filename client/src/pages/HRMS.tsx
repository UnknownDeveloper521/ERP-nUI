import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  FileText,
  Award,
  Calendar,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Plus,
  Download,
  TrendingUp,
  User,
  Fingerprint,
  MapPinCheck,
  Clock,
  AlertCircle,
  CheckSquare,
  Trash2,
  Edit,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// OT Calculation Constants (IT Industry Standards)
const OT_CONFIG = {
  MONTHLY_WORKING_DAYS: 26,
  DAILY_WORKING_HOURS: 9,
  WEEKDAY_OT_RATE: 1.5,
  WEEKEND_OT_RATE: 2.0,
  HOLIDAY_OT_RATE: 2.0,
  MAX_OT_PER_DAY: 4,
  MAX_OT_PER_MONTH: 50
};

// OT Calculation Functions
const calculateDailyWage = (grossSalary: number) => {
  return grossSalary / OT_CONFIG.MONTHLY_WORKING_DAYS;
};

const calculateHourlyWage = (grossSalary: number) => {
  const dailyWage = calculateDailyWage(grossSalary);
  return dailyWage / OT_CONFIG.DAILY_WORKING_HOURS;
};

const calculateOTAmount = (grossSalary: number, otHours: number, otType: "weekday" | "weekend" | "holiday" = "weekday") => {
  const hourlyWage = calculateHourlyWage(grossSalary);
  const rateFactor = otType === "weekday" ? OT_CONFIG.WEEKDAY_OT_RATE : (otType === "holiday" ? OT_CONFIG.HOLIDAY_OT_RATE : OT_CONFIG.WEEKEND_OT_RATE);
  return hourlyWage * otHours * rateFactor;
};

// Types
interface Shift {
  id: number;
  name: string;
  start: string;
  end: string;
  employees: number;
  days: string[];
}

interface Holiday {
  id: number;
  name: string;
  date: string;
  type: string;
}

// Mock Data
const initialEmployees = [
  { id: "EMP001", name: "Sarah Johnson", role: "Senior Developer", department: "Engineering", status: "Active", email: "sarah@tassos.com", phone: "+1-234-567-8901", location: "New York", grossSalary: 85000, basicSalary: 50000, hra: 12750, avatar: "SJ", joinDate: "2020-01-15" },
  { id: "EMP002", name: "Michael Chen", role: "Product Manager", department: "Product", status: "Active", email: "michael@tassos.com", phone: "+1-234-567-8902", location: "San Francisco", grossSalary: 92000, basicSalary: 54000, hra: 13860, avatar: "MC", joinDate: "2019-06-20" },
  { id: "EMP003", name: "Jessica Williams", role: "HR Specialist", department: "Human Resources", status: "Active", email: "jessica@tassos.com", phone: "+1-234-567-8903", location: "Boston", grossSalary: 65000, basicSalary: 38000, hra: 9880, avatar: "JW", joinDate: "2021-03-10" },
  { id: "EMP004", name: "David Miller", role: "Sales Director", department: "Sales", status: "Active", email: "david@tassos.com", phone: "+1-234-567-8904", location: "Chicago", grossSalary: 95000, basicSalary: 56000, hra: 14250, avatar: "DM", joinDate: "2018-11-05" },
  { id: "EMP005", name: "Emily Davis", role: "Marketing Lead", department: "Marketing", status: "Active", email: "emily@tassos.com", phone: "+1-234-567-8905", location: "Los Angeles", grossSalary: 75000, basicSalary: 44000, hra: 11250, avatar: "ED", joinDate: "2020-07-22" },
];

const initialAttendance = [
  { id: 1, employeeId: "EMP001", date: "2025-11-26", checkIn: "08:45", checkOut: "17:30", hours: 8.75, method: "Biometric", location: "New York Office - Main Entrance" },
  { id: 2, employeeId: "EMP002", date: "2025-11-26", checkIn: "09:00", checkOut: "17:45", hours: 8.75, method: "Web Check-in", location: "San Francisco Office - Remote" },
  { id: 3, employeeId: "EMP003", date: "2025-11-26", checkIn: "08:30", checkOut: "17:00", hours: 8.5, method: "Mobile App", location: "Boston Office - Conference Room" },
  { id: 4, employeeId: "EMP004", date: "2025-11-26", checkIn: "08:55", checkOut: "17:20", hours: 8.42, method: "Biometric", location: "Chicago Office - Main Gate" },
  { id: 5, employeeId: "EMP005", date: "2025-11-26", checkIn: "09:10", checkOut: "18:00", hours: 8.83, method: "Mobile App", location: "Los Angeles Office - Parking Lot" },
];

const defaultShifts = [
  { id: 1, name: "Morning Shift", start: "08:00", end: "16:00", employees: 45, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
  { id: 2, name: "Evening Shift", start: "16:00", end: "00:00", employees: 32, days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  { id: 3, name: "Night Shift", start: "00:00", end: "08:00", employees: 18, days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
];

const defaultHolidays = [
  { id: 1, name: "New Year", date: "2026-01-01", type: "National" },
  { id: 2, name: "Independence Day", date: "2026-07-04", type: "National" },
  { id: 3, name: "Thanksgiving", date: "2026-11-26", type: "National" },
  { id: 4, name: "Christmas", date: "2026-12-25", type: "National" },
];

const initialOvertimes = [
  { id: 1, employeeId: "EMP001", date: "2025-11-20", hours: 2.5, approvalStatus: "Approved", otType: "weekday" },
  { id: 2, employeeId: "EMP004", date: "2025-11-21", hours: 3.0, approvalStatus: "Pending", otType: "weekday" },
  { id: 3, employeeId: "EMP005", date: "2025-11-22", hours: 1.5, approvalStatus: "Approved", otType: "weekend" },
  { id: 4, employeeId: "EMP002", date: "2025-11-23", hours: 2.0, approvalStatus: "Approved", otType: "weekday" },
  { id: 5, employeeId: "EMP003", date: "2025-11-24", hours: 3.5, approvalStatus: "Approved", otType: "holiday" },
];

export default function HRMS() {
  const [activeTab, setActiveTab] = useState("employees");
  const [employees, setEmployees] = useState(initialEmployees);
  const [attendance, setAttendance] = useState(initialAttendance);

  // Shifts State with Persistence
  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem("hrms_shifts");
    return saved ? JSON.parse(saved) : defaultShifts;
  });

  // Holidays State with Persistence
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    const saved = localStorage.getItem("hrms_holidays");
    return saved ? JSON.parse(saved) : defaultHolidays;
  });

  const [overtimes, setOvertimes] = useState(initialOvertimes);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Dialog States for Shifts & Holidays
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);

  // Quick Actions Dialog States
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [isViewAttendanceOpen, setIsViewAttendanceOpen] = useState(false);
  const [isViewPayrollOpen, setIsViewPayrollOpen] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Software Developer",
    department: "Engineering",
    location: "",
    grossSalary: "",
    basicSalary: "",
    hra: "",
  });

  const [shiftForm, setShiftForm] = useState({
    name: "",
    start: "09:00",
    end: "18:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"]
  });

  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    type: "Company"
  });

  const { toast } = useToast();

  // Persist effects
  useEffect(() => {
    localStorage.setItem("hrms_shifts", JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem("hrms_holidays", JSON.stringify(holidays));
  }, [holidays]);

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Handlers ---

  const viewEmployeeDetail = (employee: any) => {
    setSelectedEmployee(employee);
    setIsDetailOpen(true);
  };

  const handleAddEmployee = () => {
    if (!newEmployee.name || !newEmployee.email || !newEmployee.phone || !newEmployee.location || !newEmployee.grossSalary || !newEmployee.basicSalary) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const newEmp = {
      id: `EMP${String(employees.length + 1).padStart(3, "0")}`,
      name: newEmployee.name,
      role: newEmployee.role,
      department: newEmployee.department,
      status: "Active",
      email: newEmployee.email,
      phone: newEmployee.phone,
      location: newEmployee.location,
      grossSalary: parseInt(newEmployee.grossSalary),
      basicSalary: parseInt(newEmployee.basicSalary),
      hra: parseInt(newEmployee.hra) || 0,
      avatar: newEmployee.name.split(" ").map(n => n[0]).join(""),
      joinDate: new Date().toISOString().split("T")[0]
    };

    setEmployees([...employees, newEmp]);
    setNewEmployee({
      name: "",
      email: "",
      phone: "",
      role: "Software Developer",
      department: "Engineering",
      location: "",
      grossSalary: "",
      basicSalary: "",
      hra: "",
    });
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: `Employee ${newEmp.name} added successfully`,
    });
  };

  // Shift Handlers
  const handleSaveShift = () => {
    if (!shiftForm.name || !shiftForm.start || !shiftForm.end) {
      toast({ variant: "destructive", title: "Error", description: "Please fill required fields" });
      return;
    }

    if (editingShift) {
      // Edit
      setShifts(shifts.map((s: Shift) => s.id === editingShift.id ? { ...s, ...shiftForm } : s));
      toast({ title: "Updated", description: "Shift updated successfully" });
    } else {
      // Create
      const newShift: Shift = {
        id: Math.max(0, ...shifts.map((s: Shift) => s.id)) + 1,
        ...shiftForm,
        employees: 0
      };
      setShifts([...shifts, newShift]);
      toast({ title: "Created", description: "New shift created successfully" });
    }
    setIsShiftDialogOpen(false);
    setEditingShift(null);
  };

  const handleDeleteShift = (id: number) => {
    if (confirm("Are you sure you want to delete this shift?")) {
      setShifts(shifts.filter((s: Shift) => s.id !== id));
      toast({ title: "Deleted", description: "Shift deleted successfully" });
    }
  };

  const openShiftDialog = (shift?: any) => {
    if (shift) {
      setEditingShift(shift);
      setShiftForm({
        name: shift.name,
        start: shift.start,
        end: shift.end,
        days: shift.days || ["Mon", "Tue", "Wed", "Thu", "Fri"]
      });
    } else {
      setEditingShift(null);
      setShiftForm({
        name: "",
        start: "09:00",
        end: "18:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"]
      });
    }
    setIsShiftDialogOpen(true);
  };

  const toggleDay = (day: string) => {
    if (shiftForm.days.includes(day)) {
      setShiftForm({ ...shiftForm, days: shiftForm.days.filter(d => d !== day) });
    } else {
      setShiftForm({ ...shiftForm, days: [...shiftForm.days, day] });
    }
  };

  // Holiday Handlers
  const handleSaveHoliday = () => {
    if (!holidayForm.name || !holidayForm.date) {
      toast({ variant: "destructive", title: "Error", description: "Please fill required fields" });
      return;
    }

    if (editingHoliday) {
      // Edit
      setHolidays(holidays.map((h: Holiday) => h.id === editingHoliday.id ? { ...h, ...holidayForm } : h));
      toast({ title: "Updated", description: "Holiday updated successfully" });
    } else {
      // Create
      const newHoliday: Holiday = {
        id: Math.max(0, ...holidays.map((h: Holiday) => h.id)) + 1,
        ...holidayForm
      };
      setHolidays([...holidays, newHoliday]);
      toast({ title: "Created", description: "New holiday added successfully" });
    }
    setIsHolidayDialogOpen(false);
    setEditingHoliday(null);
  };

  const handleDeleteHoliday = (id: number) => {
    if (confirm("Are you sure you want to delete this holiday?")) {
      setHolidays(holidays.filter((h: Holiday) => h.id !== id));
      toast({ title: "Deleted", description: "Holiday deleted successfully" });
    }
  };

  const openHolidayDialog = (holiday?: any) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm({
        name: holiday.name,
        date: holiday.date,
        type: holiday.type
      });
    } else {
      setEditingHoliday(null);
      setHolidayForm({
        name: "",
        date: "",
        type: "Company"
      });
    }
    setIsHolidayDialogOpen(true);
  };

  const getEmployeeName = (empId: string) => {
    return employees.find(e => e.id === empId)?.name || "Unknown";
  };

  const getEmployeeSalary = (empId: string) => {
    return employees.find(e => e.id === empId)?.grossSalary || 0;
  };

  // Calculate OT statistics
  const totalOTHours = overtimes.reduce((sum, ot) => sum + ot.hours, 0);
  const approvedOTHours = overtimes.filter(ot => ot.approvalStatus === "Approved").reduce((sum, ot) => sum + ot.hours, 0);
  const pendingOTHours = overtimes.filter(ot => ot.approvalStatus === "Pending").reduce((sum, ot) => sum + ot.hours, 0);
  const totalOTAmount = overtimes.reduce((sum, ot) => sum + calculateOTAmount(getEmployeeSalary(ot.employeeId), ot.hours, ot.otType as any), 0);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">HR Management & Attendance</h1>
          <p className="text-muted-foreground">Manage employees, attendance tracking, and payroll operations.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <Button asChild>
            <DialogTrigger>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Employee
            </DialogTrigger>
          </Button>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>Fill in the employee details below</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Full Name"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@tassos.com"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    placeholder="+1-234-567-8900"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    placeholder="City, State"
                    value={newEmployee.location}
                    onChange={(e) => setNewEmployee({ ...newEmployee, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newEmployee.role} onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Software Developer">Software Developer</SelectItem>
                      <SelectItem value="Senior Developer">Senior Developer</SelectItem>
                      <SelectItem value="Product Manager">Product Manager</SelectItem>
                      <SelectItem value="HR Specialist">HR Specialist</SelectItem>
                      <SelectItem value="Sales Director">Sales Director</SelectItem>
                      <SelectItem value="Marketing Lead">Marketing Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={newEmployee.department} onValueChange={(value) => setNewEmployee({ ...newEmployee, department: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Product">Product</SelectItem>
                      <SelectItem value="Human Resources">Human Resources</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grossSalary">Gross Salary *</Label>
                  <Input
                    id="grossSalary"
                    type="number"
                    placeholder="85000"
                    value={newEmployee.grossSalary}
                    onChange={(e) => setNewEmployee({ ...newEmployee, grossSalary: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basicSalary">Basic Salary *</Label>
                  <Input
                    id="basicSalary"
                    type="number"
                    placeholder="50000"
                    value={newEmployee.basicSalary}
                    onChange={(e) => setNewEmployee({ ...newEmployee, basicSalary: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hra">HRA</Label>
                  <Input
                    id="hra"
                    type="number"
                    placeholder="10000"
                    value={newEmployee.hra}
                    onChange={(e) => setNewEmployee({ ...newEmployee, hra: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddEmployee}>Add Employee</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="employees" className="w-full flex-1 flex flex-col" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto rounded-none overflow-x-auto">
          <TabsTrigger
            value="employees"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Employees
          </TabsTrigger>
          <TabsTrigger
            value="biometric"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
          >
            Biometric / RFID
          </TabsTrigger>
          <TabsTrigger
            value="checkin"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap"
          >
            Web & Mobile Check-in
          </TabsTrigger>
          <TabsTrigger
            value="shifts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Shift Scheduling
          </TabsTrigger>
          <TabsTrigger
            value="overtime"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Overtime Calculation
          </TabsTrigger>
          <TabsTrigger
            value="holidays"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Holiday Calendar
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 mt-6">
          {/* Employees Tab */}
          <TabsContent value="employees" className="m-0 h-full flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search employees..."
                  className="pl-9 bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{employee.avatar}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-xs text-muted-foreground">{employee.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {employee.department}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.status === "Active" ? "default" : "destructive"} className={employee.status === "Active" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewEmployeeDetail(employee)}
                        >
                          <User className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Biometric / RFID Tab */}
          <TabsContent value="biometric" className="m-0 flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-blue-50/50 border-blue-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Fingerprint className="h-4 w-4" /> Biometric Devices</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">12</div><p className="text-xs text-muted-foreground">Active across locations</p></CardContent>
              </Card>
              <Card className="bg-emerald-50/50 border-emerald-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Verified Today</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">2,145</div><p className="text-xs text-muted-foreground">Unique fingerprints</p></CardContent>
              </Card>
              <Card className="bg-amber-50/50 border-amber-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Failed Attempts</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">8</div><p className="text-xs text-muted-foreground">Requires investigation</p></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Biometric Enrollment Status</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>RFID Tag</TableHead>
                    <TableHead>Enrollment Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="font-mono text-sm">RFID-{emp.id}</TableCell>
                      <TableCell>{emp.joinDate}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500">Enrolled</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Web & Mobile Check-in Tab */}
          <TabsContent value="checkin" className="m-0 flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-purple-50/50 border-purple-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Today's Check-ins</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{attendance.length}</div><p className="text-xs text-muted-foreground">Recorded entries</p></CardContent>
              </Card>
              <Card className="bg-cyan-50/50 border-cyan-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg Check-in Time</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">08:47</div><p className="text-xs text-muted-foreground">AM arrival</p></CardContent>
              </Card>
              <Card className="bg-pink-50/50 border-pink-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Late Arrivals</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">2</div><p className="text-xs text-muted-foreground">After 09:00 AM</p></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Web & Mobile Check-in Log</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{getEmployeeName(rec.employeeId)}</TableCell>
                      <TableCell>{rec.checkIn}</TableCell>
                      <TableCell>{rec.checkOut}</TableCell>
                      <TableCell className="text-sm text-muted-foreground"><MapPin className="h-3 w-3 inline mr-1" />{rec.location}</TableCell>
                      <TableCell>{rec.hours}h</TableCell>
                      <TableCell><Badge variant="outline">{rec.method}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Shift Scheduling Tab - EDITABLE */}
          <TabsContent value="shifts" className="m-0 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Shift Management</h3>
              <Button onClick={() => openShiftDialog()} className="gap-2">
                <Plus className="h-4 w-4" /> Create Shift
              </Button>
            </div>

            <div className="grid gap-4">
              {shifts.map((shift) => (
                <Card key={shift.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>{shift.name}</CardTitle>
                      <CardDescription>{shift.start} - {shift.end}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{shift.employees}</div>
                      <p className="text-xs text-muted-foreground">Employees assigned</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {shift.days && shift.days.map((day: string) => (
                        <Badge key={day} variant="secondary" className="text-xs">{day}</Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline">View Assignments</Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openShiftDialog(shift)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteShift(shift.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Shift Add/Edit Dialog */}
            <Dialog open={isShiftDialogOpen} onOpenChange={setIsShiftDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingShift ? "Edit Shift" : "Create New Shift"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="shift-name">Shift Name</Label>
                    <Input
                      id="shift-name"
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                      placeholder="e.g. Morning Shift"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shift-start">Start Time</Label>
                      <Input
                        id="shift-start"
                        type="time"
                        value={shiftForm.start}
                        onChange={(e) => setShiftForm({ ...shiftForm, start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shift-end">End Time</Label>
                      <Input
                        id="shift-end"
                        type="time"
                        value={shiftForm.end}
                        onChange={(e) => setShiftForm({ ...shiftForm, end: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Applicable Days</Label>
                    <div className="flex flex-wrap gap-3">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day}`}
                            checked={shiftForm.days.includes(day)}
                            onCheckedChange={() => toggleDay(day)}
                          />
                          <label htmlFor={`day-${day}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {day}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsShiftDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveShift}>{editingShift ? "Update Shift" : "Create Shift"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Overtime Calculation Tab */}
          <TabsContent value="overtime" className="m-0 flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-indigo-50/50 border-indigo-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total OT Hours</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{totalOTHours.toFixed(1)}</div><p className="text-xs text-muted-foreground">This month</p></CardContent>
              </Card>
              <Card className="bg-teal-50/50 border-teal-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Approved OT</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{approvedOTHours.toFixed(1)}h</div><p className="text-xs text-muted-foreground">Processed</p></CardContent>
              </Card>
              <Card className="bg-yellow-50/50 border-yellow-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pending</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{pendingOTHours.toFixed(1)}h</div><p className="text-xs text-muted-foreground">Awaiting review</p></CardContent>
              </Card>
              <Card className="bg-emerald-50/50 border-emerald-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total OT Amount</CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">${totalOTAmount.toFixed(0)}</div><p className="text-xs text-muted-foreground">To be paid</p></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>OT Calculation Details</CardTitle>
                <CardDescription>Based on Gross Salary, {OT_CONFIG.MONTHLY_WORKING_DAYS} working days, {OT_CONFIG.DAILY_WORKING_HOURS} hours/day</CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>OT Hours</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Gross Salary</TableHead>
                      <TableHead>Daily Wage</TableHead>
                      <TableHead>Hourly Wage</TableHead>
                      <TableHead>Rate Factor</TableHead>
                      <TableHead className="text-right">OT Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overtimes.map((ot) => {
                      const empSalary = getEmployeeSalary(ot.employeeId);
                      const dailyWage = calculateDailyWage(empSalary);
                      const hourlyWage = calculateHourlyWage(empSalary);
                      const rateFactor = ot.otType === "weekday" ? OT_CONFIG.WEEKDAY_OT_RATE : (ot.otType === "holiday" ? OT_CONFIG.HOLIDAY_OT_RATE : OT_CONFIG.WEEKEND_OT_RATE);
                      const otAmount = calculateOTAmount(empSalary, ot.hours, ot.otType as any);

                      return (
                        <TableRow key={ot.id}>
                          <TableCell className="font-medium">{getEmployeeName(ot.employeeId)}</TableCell>
                          <TableCell>{ot.date}</TableCell>
                          <TableCell>{ot.hours}h</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {ot.otType}
                            </Badge>
                          </TableCell>
                          <TableCell>${empSalary.toLocaleString()}</TableCell>
                          <TableCell>${dailyWage.toFixed(2)}</TableCell>
                          <TableCell>${hourlyWage.toFixed(2)}</TableCell>
                          <TableCell className="font-semibold">{rateFactor}x</TableCell>
                          <TableCell className="font-bold text-right">${otAmount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={ot.approvalStatus === "Approved" ? "bg-emerald-500" : "bg-amber-500"}>
                              {ot.approvalStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

          </TabsContent>

          {/* Holiday Calendar Tab - EDITABLE */}
          <TabsContent value="holidays" className="m-0 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Holiday Management</h3>
              <Button onClick={() => openHolidayDialog()} className="gap-2">
                <Plus className="h-4 w-4" /> Add Holiday
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Holiday Calendar 2026</CardTitle>
                <CardDescription>Upcoming public holidays and company holidays.</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holiday</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell>{holiday.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{holiday.type}</Badge>
                      </TableCell>
                      <TableCell>1 day</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openHolidayDialog(holiday)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteHoliday(holiday.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Holiday Add/Edit Dialog */}
            <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add New Holiday"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="holiday-name">Holiday Name</Label>
                    <Input
                      id="holiday-name"
                      value={holidayForm.name}
                      onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                      placeholder="e.g. Independence Day"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holiday-date">Date</Label>
                    <Input
                      id="holiday-date"
                      type="date"
                      value={holidayForm.date}
                      onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holiday-type">Type</Label>
                    <Select value={holidayForm.type} onValueChange={(value) => setHolidayForm({ ...holidayForm, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="National">National</SelectItem>
                        <SelectItem value="Company">Company</SelectItem>
                        <SelectItem value="Optional">Optional</SelectItem>
                        <SelectItem value="Regional">Regional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsHolidayDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveHoliday}>{editingHoliday ? "Update Holiday" : "Add Holiday"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle>Leave Balance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary">20</div>
                    <div className="text-sm text-muted-foreground mt-1">Annual Leave Available</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">12</div>
                    <div className="text-sm text-muted-foreground mt-1">Sick Leave Available</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-amber-600">5</div>
                    <div className="text-sm text-muted-foreground mt-1">Casual Leave Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {/* Employee Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Employee Details & Salary Structure</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">{selectedEmployee.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedEmployee.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedEmployee.role}</p>
                  <Badge className="mt-2">{selectedEmployee.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Employee ID</Label>
                  <p className="text-sm font-mono">{selectedEmployee.id}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Department</Label>
                  <p className="text-sm">{selectedEmployee.department}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email</Label>
                  <p className="text-sm flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedEmployee.email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Phone</Label>
                  <p className="text-sm flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedEmployee.phone}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Location</Label>
                  <p className="text-sm flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedEmployee.location}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Join Date</Label>
                  <p className="text-sm">{selectedEmployee.joinDate}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Salary Structure</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Basic Salary</span><span className="font-semibold">${selectedEmployee.basicSalary.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>HRA (House Rent Allowance)</span><span className="font-semibold">${selectedEmployee.hra.toLocaleString()}</span></div>
                  <div className="flex justify-between border-t pt-2 mt-2"><span>Gross Salary</span><span className="font-bold text-lg">${selectedEmployee.grossSalary.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2"><span>Hourly OT Rate (Weekday)</span><span className="font-mono">${(calculateHourlyWage(selectedEmployee.grossSalary) * OT_CONFIG.WEEKDAY_OT_RATE).toFixed(2)}/hr</span></div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Quick Actions</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditEmployeeOpen(true)} data-testid="button-edit-employee">Edit Employee</Button>
                  <Button variant="outline" size="sm" onClick={() => setIsViewAttendanceOpen(true)} data-testid="button-view-attendance">View Attendance</Button>
                  <Button variant="outline" size="sm" onClick={() => setIsViewPayrollOpen(true)} data-testid="button-view-payroll">View Payroll</Button>
                  <Button variant="destructive" size="sm" onClick={() => {
                    if (confirm(`Deactivate ${selectedEmployee.name}?`)) {
                      setEmployees(employees.map(e => e.id === selectedEmployee.id ? { ...e, status: "Inactive" } : e));
                      setIsDetailOpen(false);
                      toast({ title: "Deactivated", description: `${selectedEmployee.name} has been deactivated.`, className: "bg-red-50 border-red-200" });
                    }
                  }} data-testid="button-deactivate-employee">Deactivate</Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditEmployeeOpen} onOpenChange={setIsEditEmployeeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Employee - {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input defaultValue={selectedEmployee.name} disabled className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input defaultValue={selectedEmployee.role} placeholder="e.g., Senior Developer" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input defaultValue={selectedEmployee.department} placeholder="e.g., Engineering" />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input defaultValue={selectedEmployee.location} placeholder="e.g., New York" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" defaultValue={selectedEmployee.email} placeholder="employee@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input defaultValue={selectedEmployee.phone} placeholder="+1-234-567-8901" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditEmployeeOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              toast({ title: "Saved", description: "Employee details updated successfully." });
              setIsEditEmployeeOpen(false);
            }} data-testid="button-save-employee">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Attendance Dialog */}
      <Dialog open={isViewAttendanceOpen} onOpenChange={setIsViewAttendanceOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[600px]">
          <DialogHeader>
            <DialogTitle>Attendance Records - {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-green-600">22</div>
                  <div className="text-xs text-muted-foreground mt-1">Days Present</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-red-600">2</div>
                  <div className="text-xs text-muted-foreground mt-1">Absent</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-amber-600">1</div>
                  <div className="text-xs text-muted-foreground mt-1">Leave</div>
                </CardContent>
              </Card>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.filter(a => a.employeeId === selectedEmployee?.id).map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell className="font-mono text-xs">{record.checkIn}</TableCell>
                      <TableCell className="font-mono text-xs">{record.checkOut}</TableCell>
                      <TableCell className="font-semibold">{record.hours.toFixed(2)}h</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{record.method}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewAttendanceOpen(false)}>Close</Button>
            <Button onClick={() => {
              toast({ title: "Downloaded", description: "Attendance report downloaded." });
            }} data-testid="button-download-attendance"><Download className="h-4 w-4 mr-2" />Download Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payroll Dialog */}
      <Dialog open={isViewPayrollOpen} onOpenChange={setIsViewPayrollOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Payroll Details - {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-primary/5 border border-blue-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Total Monthly Gross Salary</div>
                <div className="text-3xl font-bold text-primary">${selectedEmployee.grossSalary.toLocaleString()}</div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Salary Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between pb-2 border-b">
                    <span>Basic Salary</span>
                    <span className="font-semibold">${selectedEmployee.basicSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b">
                    <span>HRA (House Rent Allowance)</span>
                    <span className="font-semibold">${selectedEmployee.hra.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b">
                    <span>Other Allowances</span>
                    <span className="font-semibold">${(selectedEmployee.grossSalary - selectedEmployee.basicSalary - selectedEmployee.hra).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t-2 font-bold text-primary">
                    <span>Gross Salary</span>
                    <span>${selectedEmployee.grossSalary.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-xs">OT Rates</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Weekday:</span>
                    <p className="font-mono font-semibold">${(calculateHourlyWage(selectedEmployee.grossSalary) * 1.5).toFixed(2)}/hr</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Weekend:</span>
                    <p className="font-mono font-semibold">${(calculateHourlyWage(selectedEmployee.grossSalary) * 2.0).toFixed(2)}/hr</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Holiday:</span>
                    <p className="font-mono font-semibold">${(calculateHourlyWage(selectedEmployee.grossSalary) * 2.0).toFixed(2)}/hr</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewPayrollOpen(false)}>Close</Button>
            <Button onClick={() => {
              toast({ title: "Generated", description: "Payroll slip generated and ready to download." });
            }} data-testid="button-generate-payroll"><Download className="h-4 w-4 mr-2" />Generate Payslip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
