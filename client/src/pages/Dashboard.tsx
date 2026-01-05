import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Users, 
  DollarSign, 
  Package, 
  TrendingUp,
  ArrowUpRight,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  YAxis
} from "recharts";
import { useEffect, useState } from "react";

const initialData = [
  { name: "Jan", total: 2400 },
  { name: "Feb", total: 1398 },
  { name: "Mar", total: 9800 },
  { name: "Apr", total: 3908 },
  { name: "May", total: 4800 },
  { name: "Jun", total: 3800 },
  { name: "Jul", total: 4300 },
];

export default function Dashboard() {
  const [chartData, setChartData] = useState(initialData);
  const [activeEmployees, setActiveEmployees] = useState(2350);
  const [presentToday, setPresentToday] = useState(2145);
  const [openTickets, setOpenTickets] = useState(12);

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update chart data slightly
      setChartData(current => {
        const newData = [...current];
        const lastItem = { ...newData[newData.length - 1] };
        lastItem.total = Math.max(2000, Math.min(8000, lastItem.total + (Math.random() - 0.5) * 500));
        newData[newData.length - 1] = lastItem;
        return newData;
      });

      // Update metrics slightly
      if (Math.random() > 0.7) {
        setPresentToday(prev => prev + (Math.random() > 0.5 ? 1 : -1));
      }
      if (Math.random() > 0.8) {
        setOpenTickets(prev => Math.max(0, prev + (Math.random() > 0.5 ? 1 : -1)));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Executive Dashboard</h1>
        <p className="text-muted-foreground">Real-time overview of Tassos Consultancy operations.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{activeEmployees.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 text-green-600">
              <ArrowUpRight className="h-3 w-3" /> +12 this month
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#4A8FE0] shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Today</CardTitle>
            <Clock className="h-4 w-4 text-[#4A8FE0]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#4A8FE0]">{presentToday.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="text-green-600 font-medium">{Math.round((presentToday/activeEmployees)*100)}%</span> Present
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <Briefcase className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{openTickets}</div>
            <p className="text-xs text-muted-foreground">
              3 High Priority
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-600 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">8</div>
            <p className="text-xs text-muted-foreground">
              Requires action
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>
              Live tracking of organizational efficiency metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "#ffffff",
                      borderColor: "#e2e8f0",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                      padding: "12px 16px"
                    }}
                    labelStyle={{ color: "#1f2937", fontSize: "12px", fontWeight: "500" }}
                    cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                    strokeWidth={2}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>
              Latest actions across the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">John Doe applied for leave</p>
                  <p className="text-xs text-muted-foreground">
                    Sick Leave • 2 days
                  </p>
                </div>
                <div className="ml-auto font-medium text-xs text-muted-foreground">Just now</div>
              </div>
              <div className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>PO</AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">New Purchase Order #2301</p>
                  <p className="text-xs text-muted-foreground">
                    Office Supplies • $1,200.00
                  </p>
                </div>
                <div className="ml-auto font-medium text-xs text-muted-foreground">2h ago</div>
              </div>
              <div className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>IV</AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Interview Scheduled</p>
                  <p className="text-xs text-muted-foreground">
                    Candidate: Sarah Smith • Frontend Dev
                  </p>
                </div>
                <div className="ml-auto font-medium text-xs text-muted-foreground">4h ago</div>
              </div>
              <div className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>HR</AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Payroll Processed</p>
                  <p className="text-xs text-muted-foreground">
                    September 2025 • 145 Employees
                  </p>
                </div>
                <div className="ml-auto font-medium text-xs text-muted-foreground">1d ago</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
