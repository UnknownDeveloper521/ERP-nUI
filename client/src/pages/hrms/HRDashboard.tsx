import React, { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Clock, Calendar, TrendingUp, AlertCircle, CheckCircle2, MapPin, Briefcase, Factory, Warehouse, Building2, Shield, RefreshCw, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/usePermissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { hrmsDashboardApi } from "@/lib/api";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-xl border-slate-100 animate-in fade-in zoom-in duration-200">
        <p className="text-sm font-bold text-slate-800 mb-2">{label || payload[0].name}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: payload[0].color || payload[0].fill }} />
              <span className="text-xs text-slate-500 font-medium">Employee Count</span>
            </div>
            <span className="text-xs font-bold text-slate-900">{payload[0].value}</span>
          </div>
          {payload[0].payload.percent !== undefined && (
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-50">
              <span className="text-[10px] text-slate-400 font-medium uppercase">Share of Total</span>
              <span className="text-[10px] font-bold text-primary italic">
                {((payload[0].payload.percent || 0) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function HRDashboard() {
  const { toast } = useToast();
  const { hasPermission } = useHasPermission();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: apiResponse, isLoading, refetch } = useQuery({
    queryKey: ["hrms", "dashboard"],
    queryFn: () => hrmsDashboardApi.getDetails(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const dashboardData = apiResponse?.data;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Success",
        description: "The dashboard has been updated with the latest workforce metrics.",
        className: "bg-green-50 border-green-200 text-green-900 shadow-md",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh dashboard data.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Map API data to chart formats
  const roleData = dashboardData?.role_based_distribution.map(item => ({
    name: item.role_name,
    value: item.employee_count
  })) || [];

  const departmentData = dashboardData?.department_distribution.map(item => ({
    name: item.department_name,
    value: item.employee_count
  })) || [];

  const locationData = dashboardData?.work_location_snapshot.map(item => ({
    name: item.location_name,
    value: item.employee_count
  })) || [];

  const shiftData = dashboardData?.shift_distribution.map(item => ({
    name: item.shift_name,
    value: item.employee_count
  })) || [];

  const erpDistributionData = dashboardData?.erp_distribution.map(item => ({
    name: item.work_center_name,
    value: item.employee_count
  })) || [];

  const upcomingHolidays = dashboardData?.upcoming_holidays.map(holiday => {
    const date = parseISO(holiday.holiday_date);
    return {
      name: holiday.holiday_name,
      date: format(date, "dd-MM-yyyy"),
      day: format(date, "EEEE"),
      type: "Public" // Defaulting to Public as API doesn't specify type
    };
  }) || [];

  if (isLoading && !isRefreshing) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading dashboard metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Overview of human resources and workforce metrics.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50 border-blue-100 transition-all hover:shadow-md">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Employees</p>
              <h3 className="text-2xl font-bold text-blue-900">{dashboardData?.overview.total_employees || 0}</h3>
              <p className="text-xs text-blue-600/80 mt-1">Active workforce</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 transition-all hover:shadow-md">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Departments</p>
              <h3 className="text-2xl font-bold text-purple-900">{dashboardData?.overview.total_departments || 0}</h3>
              <p className="text-xs text-purple-600/80 mt-1">Operational divisions</p>
            </div>
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-100 transition-all hover:shadow-md">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">Job Roles</p>
              <h3 className="text-2xl font-bold text-amber-900">{dashboardData?.overview.total_job_roles || 0}</h3>
              <p className="text-xs text-amber-600/80 mt-1">Defined functions</p>
            </div>
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100 transition-all hover:shadow-md">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Work Locations</p>
              <h3 className="text-2xl font-bold text-green-900">{dashboardData?.overview.total_work_locations || 0}</h3>
              <p className="text-xs text-green-600/80 mt-1">Active sites</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Role-Based Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-purple-500" />
              <CardTitle>Role-Based Distribution</CardTitle>
            </div>
            <CardDescription>Employees by job role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {roleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-medium text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Department Distribution Chart */}
        <Card>
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
                    cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                    content={<CustomTooltip />}
                  />
                  <Bar 
                    name="Employees" 
                    dataKey="value" 
                    radius={[0, 4, 4, 0]} 
                    barSize={30}
                    label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (val: any) => `${val} Users` }}
                  >
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Work Location Snapshot */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              <CardTitle>Work Location Snapshot</CardTitle>
            </div>
            <CardDescription>Current workforce locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    name="Employees" 
                    dataKey="value" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                    label={{ position: 'top', fontSize: 10, fill: '#64748b' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Shift Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <CardTitle>Shift Distribution</CardTitle>
            </div>
            <CardDescription>Employees per work shift</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shiftData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${value}`}
                    dataKey="value"
                  >
                    {shiftData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={["#f59e0b", "#10b981", "#3b82f6"][index % 3]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    iconType="rect" 
                    formatter={(value) => <span className="text-xs font-medium text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ERP-Specific Distributions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-green-500" />
              <CardTitle>ERP Distribution</CardTitle>
            </div>
            <CardDescription>Unit-wise allocation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={erpDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    name="Employees" 
                    dataKey="value" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                    label={{ position: 'top', fontSize: 10, fill: '#64748b' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        {/* Upcoming Holiday Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Upcoming Holiday Timeline</CardTitle>
              <CardDescription>Scheduled organizational holidays for the remaining year</CardDescription>
            </div>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {upcomingHolidays.map((holiday, i) => (
                <div key={i} className="flex flex-col gap-2 p-4 rounded-xl border bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold bg-white">
                      {holiday.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate">{holiday.name}</p>
                    <p className="text-xs text-muted-foreground">{holiday.date} • {holiday.day}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
