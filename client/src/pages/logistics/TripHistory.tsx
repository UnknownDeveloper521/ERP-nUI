import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { CalendarIcon, Download } from "lucide-react";

export default function TripHistory() {
  const [searchTerm, setSearchTerm] = useState<string>("");

  const trips = [
    {
      id: 1,
      tripNo: "TRP-001",
      date: "2025-11-27",
      from: "Warehouse A",
      to: "Customer B",
      driver: "John Doe",
      vehicle: "TRK-001",
      status: "Completed",
      distance: "45 km",
      duration: "2h 15m",
    },
    {
      id: 2,
      tripNo: "TRP-002",
      date: "2025-11-26",
      from: "Warehouse C",
      to: "Customer D",
      driver: "Jane Smith",
      vehicle: "VAN-001",
      status: "Completed",
      distance: "32 km",
      duration: "1h 45m",
    },
    {
      id: 3,
      tripNo: "TRP-003",
      date: "2025-11-25",
      from: "Warehouse A",
      to: "Customer E",
      driver: "Mike Johnson",
      vehicle: "TRK-002",
      status: "Completed",
      distance: "58 km",
      duration: "2h 50m",
    },
  ];

  const filteredTrips = trips.filter((trip) =>
    trip.tripNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.to.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trip History</h1>
          <p className="text-muted-foreground">View all completed and historical trips</p>
        </div>
        <Button className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Filter Trips</CardTitle>
          <CardDescription>Search by trip number, driver, or destination</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search trips..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline">Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Completed Trips ({filteredTrips.length})</CardTitle>
          <CardDescription>All historical trip records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr className="text-left">
                  <th className="text-left py-3 px-4 font-medium">Trip No</th>
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-left py-3 px-4 font-medium">Driver</th>
                  <th className="text-left py-3 px-4 font-medium">Route</th>
                  <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                  <th className="text-left py-3 px-4 font-medium">Duration</th>
                  <th className="text-left py-3 px-4 font-medium">Distance</th>
                  <th className="text-left py-3 px-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip) => (
                  <tr key={trip.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{trip.tripNo}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        {trip.date}
                      </div>
                    </td>
                    <td className="py-3 px-4">{trip.driver}</td>
                    <td className="py-3 px-4 text-sm">
                      {trip.from} → {trip.to}
                    </td>
                    <td className="py-3 px-4">{trip.vehicle}</td>
                    <td className="py-3 px-4">{trip.duration}</td>
                    <td className="py-3 px-4">{trip.distance}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </td>
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
