import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Clock, Calendar, TrendingUp, AlertCircle, Briefcase, CheckCircle2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";

const attendanceData = [
  { name: "Mon", present: 145, absent: 5 },
  { name: "Tue", present: 148, absent: 2 },
  { name: "Wed", present: 142, absent: 8 },
  { name: "Thu", present: 146, absent: 4 },
  { name: "Fri", present: 144, absent: 6 },
];

const recruitmentData = [
  { name: "Applied", value: 45 },
  { name: "Screening", value: 28 },
  { name: "Interview", value: 12 },
  { name: "Offer", value: 5 },
];

export default function HRDashboard() {
  const { toast } = useToast();

  const handleReviewClick = (user: string, type: string) => {
    toast({
      title: "Review Request",
      description: `Opening ${type} request for ${user}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Overview of human resources and workforce metrics.</p>
        </div>
        <div className="flex gap-2">
            <Link href="/hrms/management">
              <Button>
                  <UserPlus className="mr-2 h-4 w-4" /> Add Employee
              </Button>
            </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Employees</p>
              <h3 className="text-2xl font-bold text-blue-900">150</h3>
              <p className="text-xs text-blue-600/80 mt-1">Active workforce</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Present Today</p>
              <h3 className="text-2xl font-bold text-green-900">142</h3>
              <p className="text-xs text-green-600/80 mt-1">94.6% Attendance</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">On Leave</p>
              <h3 className="text-2xl font-bold text-amber-900">8</h3>
              <p className="text-xs text-amber-600/80 mt-1">4 Planned, 4 Sick</p>
            </div>
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Open Positions</p>
              <h3 className="text-2xl font-bold text-purple-900">12</h3>
              <p className="text-xs text-purple-600/80 mt-1">Across 3 Depts</p>
            </div>
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Attendance Trend Chart */}
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Attendance Trend (Weekly)</CardTitle>
                <CardDescription>Daily present vs absent count</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={attendanceData}>
                            <defs>
                                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#6b7280" />
                            <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#6b7280" domain={[130, 155]} />
                            <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: "#ffffff",
                                  borderColor: "#e2e8f0",
                                  borderRadius: "8px",
                                  border: "1px solid #e2e8f0",
                                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                                }}
                            />
                            <Area type="monotone" dataKey="present" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorPresent)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        {/* Recruitment Funnel */}
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Recruitment Pipeline</CardTitle>
                <CardDescription>Candidates in active stages</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={recruitmentData} margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} fontSize={12} />
                            <Tooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ 
                                  backgroundColor: "#ffffff",
                                  borderColor: "#e2e8f0",
                                  borderRadius: "8px",
                                  border: "1px solid #e2e8f0",
                                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                                }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                                {recruitmentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"][index]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Approvals */}
        <Card>
            <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Requests requiring your action</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {[
                        { user: "Alice Cooper", type: "Sick Leave", date: "Today", status: "Pending" },
                        { user: "Bob Smith", type: "Expense Claim", date: "Yesterday", status: "Pending" },
                        { user: "Charlie Brown", type: "Shift Change", date: "2 days ago", status: "Urgent" },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback>{item.user.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium">{item.user}</p>
                                    <p className="text-xs text-muted-foreground">{item.type} • {item.date}</p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleReviewClick(item.user, item.type)}>Review</Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
            <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Birthdays, anniversaries & holidays</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Sarah's Birthday</p>
                            <p className="text-xs text-muted-foreground">Tomorrow</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Briefcase className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Work Anniversary - Mike</p>
                            <p className="text-xs text-muted-foreground">in 3 days • 5 Years</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Public Holiday</p>
                            <p className="text-xs text-muted-foreground">Next Week • Christmas</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
