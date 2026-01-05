import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Users, Building, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Departments() {
  const { toast } = useToast();
  
  // Mock Data
  const [departments, setDepartments] = useState([
    { id: 1, name: "Engineering", head: "Sarah Johnson", employees: 45, budget: "$1.2M" },
    { id: 2, name: "Sales", head: "David Miller", employees: 28, budget: "$800K" },
    { id: 3, name: "Marketing", head: "Emily Davis", employees: 15, budget: "$600K" },
    { id: 4, name: "HR", head: "Jessica Williams", employees: 8, budget: "$300K" },
  ]);

  const [designations, setDesignations] = useState([
    { id: 1, title: "Senior Developer", department: "Engineering", level: "L4" },
    { id: 2, title: "Product Manager", department: "Product", level: "L5" },
    { id: 3, title: "Sales Executive", department: "Sales", level: "L2" },
  ]);

  // Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", head: "", budget: "" });

  const [isDesigModalOpen, setIsDesigModalOpen] = useState(false);
  const [newDesig, setNewDesig] = useState({ title: "", department: "", level: "" });

  const handleAddDept = () => {
    if (!newDept.name) return;
    setDepartments([...departments, { id: Date.now(), ...newDept, employees: 0 }]);
    setIsDeptModalOpen(false);
    setNewDept({ name: "", head: "", budget: "" });
    toast({ title: "Department Added", description: `${newDept.name} has been created.` });
  };

  const handleAddDesig = () => {
    if (!newDesig.title) return;
    setDesignations([...designations, { id: Date.now(), ...newDesig }]);
    setIsDesigModalOpen(false);
    setNewDesig({ title: "", department: "", level: "" });
    toast({ title: "Designation Added", description: `${newDesig.title} has been created.` });
  };

  const handleDeleteDept = (id: number) => {
    setDepartments(departments.filter(d => d.id !== id));
    toast({ title: "Department Deleted", description: "Department has been removed." });
  };

  const handleEdit = () => {
    toast({ title: "Edit Mode", description: "Edit functionality would open here." });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department & Designation</h1>
          <p className="text-muted-foreground">Manage organizational structure and hierarchies.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Designations</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{designations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Headcount</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.reduce((acc, curr) => acc + curr.employees, 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Departments Table */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Departments</CardTitle>
              <CardDescription>List of all company departments</CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsDeptModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Department
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.head}</TableCell>
                    <TableCell>{dept.employees}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEdit}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDept(dept.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Designations Table */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Designations</CardTitle>
              <CardDescription>Roles and levels across organization</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsDesigModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Designation
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designations.map((desig) => (
                  <TableRow key={desig.id}>
                    <TableCell className="font-medium">{desig.title}</TableCell>
                    <TableCell>{desig.department}</TableCell>
                    <TableCell><Badge variant="outline">{desig.level}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Department Dialog */}
      <Dialog open={isDeptModalOpen} onOpenChange={setIsDeptModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name</Label>
              <Input className="col-span-3" value={newDept.name} onChange={(e) => setNewDept({...newDept, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Head</Label>
              <Input className="col-span-3" value={newDept.head} onChange={(e) => setNewDept({...newDept, head: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Budget</Label>
              <Input className="col-span-3" value={newDept.budget} onChange={(e) => setNewDept({...newDept, budget: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddDept}>Create Department</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Designation Dialog */}
      <Dialog open={isDesigModalOpen} onOpenChange={setIsDesigModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Designation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Title</Label>
              <Input className="col-span-3" value={newDesig.title} onChange={(e) => setNewDesig({...newDesig, title: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Department</Label>
              <Input className="col-span-3" value={newDesig.department} onChange={(e) => setNewDesig({...newDesig, department: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Level</Label>
              <Input className="col-span-3" value={newDesig.level} onChange={(e) => setNewDesig({...newDesig, level: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddDesig}>Create Designation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
