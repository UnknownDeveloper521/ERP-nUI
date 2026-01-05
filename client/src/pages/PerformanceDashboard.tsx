import React, { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Activity, Users, BarChart3 } from "lucide-react";

const TREND_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];
const DEPT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const PERF_COLORS = ['#10B981', '#3B82F6', '#F59E0B'];

// Generate mock trend data
const generateTrendData = () => {
  const data = [];
  for (let i = 0; i < 30; i++) {
    data.push({
      day: `Day ${i + 1}`,
      sales: 55 + Math.random() * 30 + i * 0.5,
      operations: 65 + Math.random() * 25 + i * 0.3,
      hr: 60 + Math.random() * 28 + i * 0.4,
    });
  }
  return data;
};

// Generate department data
const generateDeptData = () => [
  { dept: "Sales", kpi: 92 + Math.random() * 8 },
  { dept: "Operations", kpi: 85 + Math.random() * 10 },
  { dept: "HR", kpi: 88 + Math.random() * 8 },
  { dept: "Finance", kpi: 90 + Math.random() * 7 },
  { dept: "IT", kpi: 87 + Math.random() * 9 },
  { dept: "Logistics", kpi: 83 + Math.random() * 12 },
];

// Generate performance distribution
const generatePerfDistribution = () => [
  { name: "Top Performers", value: 32 },
  { name: "Meets Expectations", value: 58 },
  { name: "Needs Improvement", value: 10 },
];

// Live metric data
const generateLiveMetric = () => ({
  activeEmployees: Math.floor(120 + Math.random() * 40),
  openTasks: Math.floor(45 + Math.random() * 15),
  activeChats: Math.floor(12 + Math.random() * 8),
});

export default function PerformanceDashboard() {
  const [timeRange, setTimeRange] = useState("7d");
  const [metricFilter, setMetricFilter] = useState("all");
  const [trendData, setTrendData] = useState(generateTrendData());
  const [deptData, setDeptData] = useState(generateDeptData());
  const [perfDistribution, setPerfDistribution] = useState(generatePerfDistribution());
  const [liveMetric, setLiveMetric] = useState(generateLiveMetric());
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Simulate live updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTrendData((prev) => {
        const newData = [...prev.slice(1)];
        newData.push({
          day: `Day ${prev.length}`,
          sales: prev[prev.length - 1].sales + (Math.random() - 0.5) * 10,
          operations: prev[prev.length - 1].operations + (Math.random() - 0.5) * 10,
          hr: prev[prev.length - 1].hr + (Math.random() - 0.5) * 10,
        });
        return newData;
      });
      setDeptData(generateDeptData());
      setLiveMetric(generateLiveMetric());
      setLastUpdated(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const filteredTrendData = trendData.slice(
    timeRange === "7d" ? -7 : timeRange === "30d" ? -30 : -90
  );

  const getTrendLines = () => {
    const lines = [];
    if (metricFilter === "all" || metricFilter === "sales") {
      lines.push(<Line key="sales" type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2} dot={false} />);
    }
    if (metricFilter === "all" || metricFilter === "operations") {
      lines.push(<Line key="ops" type="monotone" dataKey="operations" stroke="#10B981" strokeWidth={2} dot={false} />);
    }
    if (metricFilter === "all" || metricFilter === "hr") {
      lines.push(<Line key="hr" type="monotone" dataKey="hr" stroke="#F59E0B" strokeWidth={2} dot={false} />);
    }
    return lines;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-600">Real-time organizational metrics and KPI tracking</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Time Range:</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Metric:</label>
            <Select value={metricFilter} onValueChange={setMetricFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Metrics</SelectItem>
                <SelectItem value="sales">Sales Performance</SelectItem>
                <SelectItem value="operations">Operations Performance</SelectItem>
                <SelectItem value="hr">HR Performance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-xs text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Live Active Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{liveMetric.activeEmployees}</div>
              <p className="text-xs text-gray-600 mt-2">Currently online</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-600" />
                Open Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{liveMetric.openTasks}</div>
              <p className="text-xs text-gray-600 mt-2">Active this week</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                Active Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{liveMetric.activeChats}</div>
              <p className="text-xs text-gray-600 mt-2">Team communications</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts */}
        <div className="grid gap-6">
          {/* Overall Performance Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Overall Performance Trend
              </CardTitle>
              <CardDescription>Multi-department KPI performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={filteredTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    formatter={(value: number) => value.toFixed(1)}
                  />
                  <Legend />
                  {getTrendLines()}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bottom Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Department KPI */}
            <Card>
              <CardHeader>
                <CardTitle>Department-wise KPI</CardTitle>
                <CardDescription>Target achievement by department</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                      formatter={(value: number) => value.toFixed(1)}
                    />
                    <Bar dataKey="kpi" fill="#3B82F6" radius={[8, 8, 0, 0]}>
                      {deptData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Performance Distribution</CardTitle>
                <CardDescription>Performance rating breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={perfDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {perfDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PERF_COLORS[index % PERF_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Details Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Sales Performance</p>
                  <p className="text-2xl font-bold text-blue-600">↑ 8.2%</p>
                  <p className="text-xs text-gray-500 mt-2">Trending upward this month</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Operations Efficiency</p>
                  <p className="text-2xl font-bold text-green-600">↑ 5.1%</p>
                  <p className="text-xs text-gray-500 mt-2">Improved process optimization</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-gray-600">HR/People Score</p>
                  <p className="text-2xl font-bold text-amber-600">↑ 3.7%</p>
                  <p className="text-xs text-gray-500 mt-2">Employee engagement high</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
