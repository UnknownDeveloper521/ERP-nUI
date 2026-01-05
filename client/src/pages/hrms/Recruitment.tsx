import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Calendar, MapPin, Briefcase, ChevronRight, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Recruitment() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("jobs");
  const [isPostJobOpen, setIsPostJobOpen] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", dept: "", type: "Full-time", location: "Remote" });

  // Mock Data
  const [jobs, setJobs] = useState([
    { id: 1, title: "Senior React Developer", dept: "Engineering", type: "Full-time", location: "Remote", applicants: 12, status: "Active" },
    { id: 2, title: "Product Designer", dept: "Product", type: "Full-time", location: "New York", applicants: 8, status: "Active" },
    { id: 3, title: "Sales Manager", dept: "Sales", type: "Full-time", location: "Chicago", applicants: 24, status: "Closed" },
  ]);

  const [candidates, setCandidates] = useState([
    { id: 1, name: "Alex Morgan", role: "Senior React Developer", stage: "Interview", rating: 4.5, applied: "2 days ago" },
    { id: 2, name: "Sam Smith", role: "Product Designer", stage: "Screening", rating: 3.8, applied: "1 day ago" },
    { id: 3, name: "Jordan Lee", role: "Senior React Developer", stage: "Offer", rating: 4.8, applied: "1 week ago" },
  ]);

  const [selectedJob, setSelectedJob] = useState<any>(null);

  const handlePostJob = () => {
    if (!newJob.title) return;
    setJobs([...jobs, { id: Date.now(), ...newJob, applicants: 0, status: "Active" }]);
    setIsPostJobOpen(false);
    setNewJob({ title: "", dept: "", type: "Full-time", location: "Remote" });
    toast({ title: "Job Posted", description: `${newJob.title} is now active.` });
  };

  const handleScheduleInterview = () => {
     toast({ title: "Schedule Interview", description: "Calendar integration would open here." });
  }

  const handleViewDetails = (job: any) => {
    setSelectedJob(job);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recruitment & ATS</h1>
          <p className="text-muted-foreground">Manage job postings and candidate pipelines.</p>
        </div>
        <Button onClick={() => setIsPostJobOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Post New Job
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="jobs">Job Openings</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="interviews">Interview Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant={job.status === "Active" ? "default" : "secondary"}>{job.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                  </div>
                  <CardTitle className="text-lg mt-2">{job.title}</CardTitle>
                  <CardDescription>{job.dept}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Briefcase className="h-3 w-3" /> {job.type}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {job.location}</div>
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">{job.applicants} Applicants</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleViewDetails(job)}>View Details</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="candidates" className="space-y-4">
          <div className="flex gap-4 overflow-x-auto pb-4">
             {/* Kanban Board Style Columns */}
             {["Applied", "Screening", "Interview", "Offer"].map((stage) => (
               <div key={stage} className="min-w-[280px] bg-muted/30 rounded-lg p-3">
                 <h3 className="font-semibold mb-3 flex items-center justify-between">
                   {stage}
                   <Badge variant="outline" className="ml-2">{candidates.filter(c => c.stage === stage).length}</Badge>
                 </h3>
                 <div className="space-y-3">
                   {candidates.filter(c => c.stage === stage).map(c => (
                     <Card key={c.id} className="p-3">
                       <div className="flex justify-between items-start mb-2">
                         <div className="font-medium">{c.name}</div>
                         <Badge variant="secondary" className="text-xs">{c.rating} ★</Badge>
                       </div>
                       <div className="text-xs text-muted-foreground mb-2">{c.role}</div>
                       <div className="text-xs text-muted-foreground">{c.applied}</div>
                     </Card>
                   ))}
                 </div>
               </div>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="interviews">
           <Card>
             <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
               <Calendar className="h-10 w-10 mb-4 opacity-50" />
               <p>No interviews scheduled for today.</p>
               <Button variant="link" onClick={handleScheduleInterview}>Schedule an Interview</Button>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPostJobOpen} onOpenChange={setIsPostJobOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post New Job</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Title</Label>
              <Input className="col-span-3" value={newJob.title} onChange={(e) => setNewJob({...newJob, title: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Department</Label>
              <Input className="col-span-3" value={newJob.dept} onChange={(e) => setNewJob({...newJob, dept: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Location</Label>
              <Input className="col-span-3" value={newJob.location} onChange={(e) => setNewJob({...newJob, location: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePostJob}>Create Job Posting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title}</DialogTitle>
            <DialogDescription>{selectedJob?.dept} • {selectedJob?.location} • {selectedJob?.type}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
               <h3 className="font-semibold">Job Description</h3>
               <p className="text-sm text-muted-foreground">
                 We are looking for a talented {selectedJob?.title} to join our {selectedJob?.dept} team. 
                 The ideal candidate will have 3+ years of experience and a passion for building great products.
               </p>
             </div>
             <div className="space-y-2">
               <h3 className="font-semibold">Requirements</h3>
               <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                 <li>Bachelor's degree in Computer Science or related field</li>
                 <li>Strong proficiency in relevant technologies</li>
                 <li>Excellent problem-solving skills</li>
                 <li>Good communication skills</li>
               </ul>
             </div>
             <div className="flex gap-4 pt-4 border-t">
               <div className="text-center">
                 <div className="text-2xl font-bold">{selectedJob?.applicants}</div>
                 <div className="text-xs text-muted-foreground">Applicants</div>
               </div>
               <div className="text-center border-l pl-4">
                 <div className="text-2xl font-bold">Active</div>
                 <div className="text-xs text-muted-foreground">Status</div>
               </div>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedJob(null)}>Close</Button>
            <Button>Edit Posting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
