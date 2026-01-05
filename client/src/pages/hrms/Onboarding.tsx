import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Mail, Laptop, FileText, UserCheck } from "lucide-react";

export default function Onboarding() {
  const [activeTab, setActiveTab] = useState("onboarding");

  const onboardingEmployees = [
    { id: 1, name: "Michael Scott", role: "Regional Manager", startData: "2025-01-15", progress: 80, status: "In Progress" },
    { id: 2, name: "Pam Beesly", role: "Receptionist", startData: "2025-01-20", progress: 45, status: "In Progress" },
    { id: 3, name: "Jim Halpert", role: "Sales Executive", startData: "2025-01-10", progress: 100, status: "Completed" },
  ];

  const offboardingEmployees = [
    { id: 4, name: "Dwight Schrute", role: "Assistant Regional Manager", exitDate: "2025-02-01", status: "Notice Period" },
  ];

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onboarding & Offboarding</h1>
          <p className="text-muted-foreground">Streamline employee joining and exit processes.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="offboarding">Offboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding" className="space-y-4">
           {onboardingEmployees.map((emp) => (
             <Card key={emp.id}>
               <CardContent className="p-6">
                 <div className="flex flex-col md:flex-row gap-6 items-center">
                   <Avatar className="h-16 w-16">
                     <AvatarFallback>{emp.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                   </Avatar>
                   <div className="flex-1 w-full">
                     <div className="flex justify-between items-start mb-2">
                       <div>
                         <h3 className="font-semibold text-lg">{emp.name}</h3>
                         <p className="text-sm text-muted-foreground">{emp.role} • Starts {emp.startData}</p>
                       </div>
                       <div className="text-right">
                         <span className="text-sm font-medium">{emp.progress}% Completed</span>
                       </div>
                     </div>
                     <Progress value={emp.progress} className="h-2 mb-4" />
                     
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          {emp.progress >= 25 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          <span>Documentation</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {emp.progress >= 50 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          <span>IT Assets</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {emp.progress >= 75 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          <span>Email Setup</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {emp.progress === 100 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          <span>Orientation</span>
                        </div>
                     </div>
                   </div>
                   <Button variant="outline">Manage</Button>
                 </div>
               </CardContent>
             </Card>
           ))}
        </TabsContent>

        <TabsContent value="offboarding" className="space-y-4">
          {offboardingEmployees.map((emp) => (
             <Card key={emp.id}>
               <CardContent className="p-6">
                 <div className="flex justify-between items-center">
                   <div>
                     <h3 className="font-semibold text-lg">{emp.name}</h3>
                     <p className="text-sm text-muted-foreground">{emp.role}</p>
                     <p className="text-xs text-red-500 mt-1">Exit Date: {emp.exitDate}</p>
                   </div>
                   <div className="flex gap-2">
                     <Button variant="outline" size="sm">Asset Recovery</Button>
                     <Button variant="destructive" size="sm">Process Exit</Button>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
