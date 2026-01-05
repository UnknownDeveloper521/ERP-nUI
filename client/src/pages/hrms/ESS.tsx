import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, Clock, Briefcase, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function ESS() {
  const { toast } = useToast();
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [leaveRequest, setLeaveRequest] = useState({ type: "", startDate: "", endDate: "", reason: "" });

  const handleApplyLeave = () => {
    if (!leaveRequest.type || !leaveRequest.startDate || !leaveRequest.endDate) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    setIsLeaveDialogOpen(false);
    toast({ title: "Leave Applied", description: "Your leave request has been submitted for approval." });
    setLeaveRequest({ type: "", startDate: "", endDate: "", reason: "" });
  };

  const handleDownload = (docName: string) => {
    toast({ title: "Downloading...", description: `Starting download for ${docName}` });
  };

  const handleViewHistory = () => {
    toast({ title: "Attendance History", description: "Showing attendance logs for the last 30 days." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Self-Service</h1>
          <p className="text-muted-foreground">Manage your profile, leaves, and documents.</p>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div>
             <p className="text-sm font-medium">John Doe</p>
             <p className="text-xs text-muted-foreground">Senior Developer</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
         {/* Leave Balance Card */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Leave Balance</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="flex justify-between items-end">
               <div>
                 <div className="text-3xl font-bold">12</div>
                 <p className="text-xs text-muted-foreground mt-1">Days Available</p>
               </div>
               <Button size="sm" onClick={() => setIsLeaveDialogOpen(true)}>Apply Leave</Button>
             </div>
             <div className="mt-4 flex gap-2">
               <Badge variant="secondary">Casual: 5</Badge>
               <Badge variant="secondary">Sick: 7</Badge>
             </div>
           </CardContent>
         </Card>

         {/* Today's Attendance */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Today's Attendance</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="flex justify-between items-center mb-2">
               <Badge className="bg-green-600">Present</Badge>
               <span className="text-sm font-mono">09:15 AM</span>
             </div>
             <div className="text-xs text-muted-foreground mb-4">Checked in via Biometric</div>
             <Button variant="outline" size="sm" className="w-full" onClick={handleViewHistory}>View History</Button>
           </CardContent>
         </Card>

         {/* Payroll Info */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">Latest Payslip</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="flex justify-between items-center mb-2">
               <span className="font-bold">November 2025</span>
               <span className="text-green-600 font-bold">$4,500</span>
             </div>
             <Button variant="outline" size="sm" className="w-full" onClick={() => handleDownload("Payslip_Nov_2025.pdf")}>
               <Download className="h-4 w-4 mr-2" /> Download PDF
             </Button>
           </CardContent>
         </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Documents</CardTitle>
            <CardDescription>Access your personal and employment documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
             {[
               "Offer Letter.pdf",
               "Appointment Letter.pdf",
               "Experience Certificate.pdf", 
               "Tax Declaration FY25.pdf"
             ].map((doc, i) => (
               <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleDownload(doc)}>
                 <div className="flex items-center gap-3">
                   <FileText className="h-5 w-5 text-blue-600" />
                   <span className="text-sm font-medium">{doc}</span>
                 </div>
                 <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}>
                    <Download className="h-4 w-4 text-muted-foreground" />
                 </Button>
               </div>
             ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
            <CardDescription>Company holiday calendar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
               <div className="h-12 w-12 rounded-lg bg-red-100 flex flex-col items-center justify-center text-red-700">
                 <span className="text-xs font-bold">DEC</span>
                 <span className="text-lg font-bold">25</span>
               </div>
               <div>
                 <p className="font-medium">Christmas Day</p>
                 <p className="text-xs text-muted-foreground">Thursday • National Holiday</p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="h-12 w-12 rounded-lg bg-red-100 flex flex-col items-center justify-center text-red-700">
                 <span className="text-xs font-bold">JAN</span>
                 <span className="text-lg font-bold">01</span>
               </div>
               <div>
                 <p className="font-medium">New Year's Day</p>
                 <p className="text-xs text-muted-foreground">Thursday • National Holiday</p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit your leave request for approval.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select onValueChange={(val) => setLeaveRequest({...leaveRequest, type: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="earned">Earned Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" onChange={(e) => setLeaveRequest({...leaveRequest, startDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" onChange={(e) => setLeaveRequest({...leaveRequest, endDate: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea placeholder="Reason for leave..." onChange={(e) => setLeaveRequest({...leaveRequest, reason: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyLeave}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
