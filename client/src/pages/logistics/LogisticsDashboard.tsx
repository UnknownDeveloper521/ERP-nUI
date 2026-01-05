import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Package, Truck, Clock } from "lucide-react";
import { Link } from "wouter";

export default function LogisticsDashboard() {
  const stats = [
    { label: "Active Trips", value: "24", icon: Truck, color: "bg-blue-50" },
    { label: "Pending Weighment", value: "8", icon: Package, color: "bg-yellow-50" },
    { label: "Completed Today", value: "42", icon: TrendingUp, color: "bg-green-50" },
    { label: "Avg Delivery Time", value: "2.4h", icon: Clock, color: "bg-purple-50" },
  ];

  const recentTrips = [
    { id: 1, tripNo: "TRP-001", from: "Warehouse A", to: "Customer B", status: "In Transit", date: "2025-11-27" },
    { id: 2, tripNo: "TRP-002", from: "Warehouse C", to: "Customer D", status: "Pending", date: "2025-11-27" },
    { id: 3, tripNo: "TRP-003", from: "Warehouse A", to: "Customer E", status: "Completed", date: "2025-11-26" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics Management</h1>
          <p className="text-muted-foreground">Track shipments, manage trips, and optimize routes</p>
        </div>
        <Link href="/logistics/new-trip">
          <Button className="gap-2">
            <Truck className="h-4 w-4" />
            New Trip
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className={`flex gap-4 items-start`}>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Recent Trips</CardTitle>
          <CardDescription>Latest shipments and delivery status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Trip No</th>
                  <th className="text-left py-3 px-4 font-medium">From</th>
                  <th className="text-left py-3 px-4 font-medium">To</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTrips.map((trip) => (
                  <tr key={trip.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{trip.tripNo}</td>
                    <td className="py-3 px-4">{trip.from}</td>
                    <td className="py-3 px-4">{trip.to}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        trip.status === "Completed" ? "bg-green-50 text-green-700" :
                        trip.status === "In Transit" ? "bg-blue-50 text-blue-700" :
                        "bg-yellow-50 text-yellow-700"
                      }`}>
                        {trip.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{trip.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
