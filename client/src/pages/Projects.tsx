import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Clock, CheckCircle2, MoreHorizontal, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const initialProjects = [
  {
    id: 1,
    title: "Website Redesign",
    client: "Acme Corp",
    status: "In Progress",
    progress: 65,
    dueDate: "2024-04-15",
    team: ["JD", "JS", "TS"],
    priority: "High",
    description: "Overhauling the corporate website with new branding guidelines."
  },
  {
    id: 2,
    title: "Mobile App Development",
    client: "Global Tech",
    status: "Planning",
    progress: 15,
    dueDate: "2024-06-30",
    team: ["BW", "SC"],
    priority: "Medium",
    description: "Native iOS and Android application for customer loyalty program."
  },
  {
    id: 3,
    title: "Cloud Migration",
    client: "Stark Ind",
    status: "Completed",
    progress: 100,
    dueDate: "2024-03-01",
    team: ["TS", "JD"],
    priority: "Critical",
    description: "Migrating on-premise infrastructure to AWS."
  },
  {
    id: 4,
    title: "Security Audit",
    client: "Wayne Ent",
    status: "In Progress",
    progress: 45,
    dueDate: "2024-05-10",
    team: ["BW"],
    priority: "High",
    description: "Annual security penetration testing and vulnerability assessment."
  }
];

export default function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  
  const [newProject, setNewProject] = useState({
    title: "",
    client: "",
    status: "Planning",
    priority: "Medium",
    description: "",
    dueDate: ""
  });

  const handleAddProject = () => {
    const id = projects.length + 1;
    const project = {
      id,
      title: newProject.title,
      client: newProject.client,
      status: newProject.status,
      priority: newProject.priority,
      description: newProject.description,
      dueDate: newProject.dueDate || new Date().toISOString().split('T')[0],
      progress: 0,
      team: ["JD"] // Default team member
    };

    setProjects([...projects, project]);
    setIsNewProjectOpen(false);
    setNewProject({ title: "", client: "", status: "Planning", priority: "Medium", description: "", dueDate: "" });
    
    toast({
      title: "Project Created",
      description: `${project.title} has been successfully created.`,
    });
  };

  const handleDeleteProject = (id: number) => {
    setProjects(projects.filter(p => p.id !== id));
    toast({
      title: "Project Deleted",
      description: "The project has been removed.",
      variant: "destructive"
    });
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setIsEditProjectOpen(true);
  };

  const handleUpdateProject = () => {
    if (!editingProject) return;
    
    setProjects(projects.map(p => p.id === editingProject.id ? editingProject : p));
    setIsEditProjectOpen(false);
    setEditingProject(null);
    
    toast({
      title: "Project Updated",
      description: `${editingProject.title} has been successfully updated.`,
    });
  };

  const renderProjectCard = (project: any) => (
    <Card key={project.id} className="flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <Badge variant={project.status === "Completed" ? "secondary" : project.priority === "Critical" ? "destructive" : "default"} className="mb-2">
            {project.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditProject(project)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteProject(project.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="line-clamp-1">{project.title}</CardTitle>
        <CardDescription className="line-clamp-1">Client: {project.client}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {project.description}
        </p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2" />
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4 flex justify-between items-center">
        <div className="flex -space-x-2">
          {project.team.map((member: string, i: number) => (
            <Avatar key={i} className="h-8 w-8 border-2 border-background">
              <AvatarFallback className="text-xs">{member}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Due {project.dueDate}</span>
        </div>
      </CardFooter>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Management</h1>
          <p className="text-muted-foreground">Track timelines, resources, and deliverables.</p>
        </div>
        
        {/* Create Project Dialog */}
        <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">Project Title</Label>
                <Input 
                  id="title" 
                  value={newProject.title} 
                  onChange={(e) => setNewProject({...newProject, title: e.target.value})} 
                  className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="client" className="text-right">Client</Label>
                <Input 
                  id="client" 
                  value={newProject.client} 
                  onChange={(e) => setNewProject({...newProject, client: e.target.value})} 
                  className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select 
                  value={newProject.status} 
                  onValueChange={(value) => setNewProject({...newProject, status: value})}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planning">Planning</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priority" className="text-right">Priority</Label>
                <Select 
                  value={newProject.priority} 
                  onValueChange={(value) => setNewProject({...newProject, priority: value})}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dueDate" className="text-right">Due Date</Label>
                <Input 
                  id="dueDate" 
                  type="date"
                  value={newProject.dueDate} 
                  onChange={(e) => setNewProject({...newProject, dueDate: e.target.value})} 
                  className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Description</Label>
                <Textarea 
                  id="description" 
                  value={newProject.description} 
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})} 
                  className="col-span-3" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddProject}>Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Project Dialog */}
        <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
            </DialogHeader>
            {editingProject && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-title" className="text-right">Project Title</Label>
                  <Input 
                    id="edit-title" 
                    value={editingProject.title} 
                    onChange={(e) => setEditingProject({...editingProject, title: e.target.value})} 
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-client" className="text-right">Client</Label>
                  <Input 
                    id="edit-client" 
                    value={editingProject.client} 
                    onChange={(e) => setEditingProject({...editingProject, client: e.target.value})} 
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-status" className="text-right">Status</Label>
                  <Select 
                    value={editingProject.status} 
                    onValueChange={(value) => setEditingProject({...editingProject, status: value})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planning">Planning</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-priority" className="text-right">Priority</Label>
                  <Select 
                    value={editingProject.priority} 
                    onValueChange={(value) => setEditingProject({...editingProject, priority: value})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-progress" className="text-right">Progress (%)</Label>
                  <Input 
                    id="edit-progress" 
                    type="number"
                    min="0"
                    max="100"
                    value={editingProject.progress} 
                    onChange={(e) => setEditingProject({...editingProject, progress: parseInt(e.target.value) || 0})} 
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-dueDate" className="text-right">Due Date</Label>
                  <Input 
                    id="edit-dueDate" 
                    type="date"
                    value={editingProject.dueDate} 
                    onChange={(e) => setEditingProject({...editingProject, dueDate: e.target.value})} 
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-description" className="text-right">Description</Label>
                  <Textarea 
                    id="edit-description" 
                    value={editingProject.description} 
                    onChange={(e) => setEditingProject({...editingProject, description: e.target.value})} 
                    className="col-span-3" 
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleUpdateProject}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map(renderProjectCard)}
            
            {/* Add New Project Card Placeholder */}
            <Button 
              variant="outline" 
              className="h-full min-h-[250px] flex flex-col gap-4 border-dashed"
              onClick={() => setIsNewProjectOpen(true)}
            >
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <span className="font-semibold">Create New Project</span>
                <p className="text-xs text-muted-foreground mt-1">Start a new project from scratch</p>
              </div>
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="active" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.filter(p => p.status !== "Completed").map(renderProjectCard)}
            {projects.filter(p => p.status !== "Completed").length === 0 && (
               <div className="col-span-full flex items-center justify-center h-32 text-muted-foreground border-2 border-dashed rounded-lg">
                 No active projects found
               </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.filter(p => p.status === "Completed").map(renderProjectCard)}
             {projects.filter(p => p.status === "Completed").length === 0 && (
               <div className="col-span-full flex items-center justify-center h-32 text-muted-foreground border-2 border-dashed rounded-lg">
                 No completed projects found
               </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
