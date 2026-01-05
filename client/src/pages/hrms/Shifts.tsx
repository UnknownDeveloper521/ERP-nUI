import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calendar, Users, Moon, Sun, Filter } from "lucide-react";

export default function Shifts() {
  const [shifts, setShifts] = useState([
    { id: 1, name: "Morning Shift", time: "09:00 AM - 06:00 PM", type: "Regular", employees: 42, status: "Active" },
    { id: 2, name: "Night Shift", time: "09:00 PM - 06:00 AM", type: "Rotational", employees: 12, status: "Active" },
    { id: 3, name: "Support Shift", time: "02:00 PM - 11:00 PM", type: "Rotational", employees: 8, status: "Active" },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time & Shift Management</h1>
          <p className="text-muted-foreground">Manage work schedules and rotational shifts.</p>
        </div>
        <Button>Create New Shift</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-blue-50 border-blue-200">
           <CardContent className="pt-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-blue-100 rounded-lg"><Sun className="h-6 w-6 text-blue-600" /></div>
               <div>
                 <p className="text-sm font-medium text-blue-900">Morning Shift</p>
                 <h3 className="text-2xl font-bold text-blue-700">42</h3>
               </div>
             </div>
           </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-indigo-200">
           <CardContent className="pt-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-indigo-100 rounded-lg"><Moon className="h-6 w-6 text-indigo-600" /></div>
               <div>
                 <p className="text-sm font-medium text-indigo-900">Night Shift</p>
                 <h3 className="text-2xl font-bold text-indigo-700">12</h3>
               </div>
             </div>
           </CardContent>
        </Card>
        <Card>
           <CardContent className="pt-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-gray-100 rounded-lg"><Users className="h-6 w-6 text-gray-600" /></div>
               <div>
                 <p className="text-sm font-medium text-gray-900">Total Active</p>
                 <h3 className="text-2xl font-bold text-gray-700">62</h3>
               </div>
             </div>
           </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shift Schedule</CardTitle>
          <CardDescription>Current active shifts configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift Name</TableHead>
                <TableHead>Timings</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Employees Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {shift.time}</TableCell>
                  <TableCell>{shift.type}</TableCell>
                  <TableCell>{shift.employees}</TableCell>
                  <TableCell><Badge className="bg-green-600">{shift.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
