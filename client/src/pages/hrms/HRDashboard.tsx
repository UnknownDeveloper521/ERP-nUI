import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Clock, Calendar, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";

const attendanceData = [
  { name: "Mon", present: 18, absent: 2 },
  { name: "Tue", present: 19, absent: 1 },
  { name: "Wed", present: 17, absent: 3 },
  { name: "Thu", present: 18, absent: 2 },
  { name: "Fri", present: 18, absent: 2 },
];

const upcomingHolidays = [
  { name: "Independence Day", date: "15-08-2026", day: "Saturday" },
  { name: "Gandhi Jayanti", date: "02-10-2026", day: "Friday" },
  { name: "Diwali", date: "01-11-2026", day: "Sunday" }
];

const departmentData = [
  { name: "IT", value: 5 },
  { name: "HR", value: 5 },
  { name: "Sales", value: 5 },
  { name: "Finance", value: 5 },
];

export default function HRDashboard() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Overview of human resources and workforce metrics.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hrms/core-hr">
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
              <h3 className="text-2xl font-bold text-blue-900">20</h3>
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
              <h3 className="text-2xl font-bold text-green-900">18</h3>
              <p className="text-xs text-green-600/80 mt-1">90% Attendance</p>
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
              <h3 className="text-2xl font-bold text-amber-900">2</h3>
              <p className="text-xs text-amber-600/80 mt-1">1 Planned, 1 Sick</p>
            </div>
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Pending Leaves</p>
              <h3 className="text-2xl font-bold text-purple-900">2</h3>
              <p className="text-xs text-purple-600/80 mt-1">Requires action</p>
            </div>
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Clock className="h-5 w-5 text-purple-600" />
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
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#6b7280" />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#6b7280" domain={[15, 20]} />
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

        {/* Department Distribution Chart */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Department Distribution</CardTitle>
            <CardDescription>Employee count per department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={departmentData} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e2e8f0",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"][index % 4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Birthdays, anniversaries & holidays</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingHolidays.map((holiday, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{holiday.name}</p>
                    <p className="text-xs text-muted-foreground">{holiday.date} • {holiday.day}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Sarah's Birthday</p>
                  <p className="text-xs text-muted-foreground">Tomorrow</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
