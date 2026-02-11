import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

// Mock Data
const MOCK_COMPANIES = [
    { id: "1", name: "Alpha HQ", code: "COMP01", tenant: "Alpha Corp", tenantId: "1", gst: "GST12345", country: "USA", status: "active", createdAt: "2024-01-20", createdBy: "Admin", updatedAt: "2024-01-25", updatedBy: "Admin", deletedAt: null, deletedBy: null },
    { id: "2", name: "Alpha Branch 1", code: "COMP02", tenant: "Alpha Corp", tenantId: "1", gst: "GST12346", country: "Canada", status: "active", createdAt: "2024-02-10", createdBy: "Admin", updatedAt: "2024-02-12", updatedBy: "Manager", deletedAt: null, deletedBy: null },
    { id: "3", name: "Beta Main", code: "COMP03", tenant: "Beta Industries", tenantId: "2", gst: "GST67890", country: "UK", status: "active", createdAt: "2024-03-01", createdBy: "System", updatedAt: "2024-03-05", updatedBy: "Admin", deletedAt: null, deletedBy: null },
];

type Company = {
    id: string;
    name: string;
    code: string;
    tenant: string;
    tenantId: string;
    gst: string;
    country: string;
    status: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deletedAt: string | null;
    deletedBy: string | null;
};

const companySchema = z.object({
    tenantId: z.string().min(1, "Tenant is required"),
    name: z.string().min(1, "Company Name is required"),
    code: z.string().min(1, "Company Code is required"),
    gst: z.string().min(1, "GST/VAT No is required"),
    country: z.string().min(1, "Country is required"),
    status: z.enum(["active", "inactive"], {
        required_error: "Status is required",
    }),
});

export default function CompanyManagement() {
    const [companies, setCompanies] = useState<Company[]>(MOCK_COMPANIES);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<any>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<any>(null);

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tenant.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const form = useForm<z.infer<typeof companySchema>>({
        resolver: zodResolver(companySchema),
        mode: "onChange",
        defaultValues: {
            tenantId: "",
            name: "",
            code: "",
            gst: "",
            country: "",
            status: "active",
        },
    });

    const onFormSubmit = (data: z.infer<typeof companySchema>) => {
        console.log("Submitted:", data);
        toast.success(editingCompany ? "Company updated" : "Company created");
        setIsAddOpen(false);
        setEditingCompany(null);
        form.reset();
    };

    const handleAddCompany = (e: React.FormEvent) => {
        e.preventDefault();
        // Deprecated, using onFormSubmit
    };

    const openAddDialog = () => {
        setEditingCompany(null);
        setIsAddOpen(true);
    };

    const openEditDialog = (company: any) => {
        setEditingCompany(company);
        setIsAddOpen(true);
    };

    const handleDeleteClick = (company: any) => {
        setCompanyToDelete(company);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = () => {
        if (companyToDelete) {
            setCompanies(companies.map(c =>
                c.id === companyToDelete.id
                    ? {
                        ...c,
                        status: "inactive",
                        deletedAt: new Date().toISOString(),
                        deletedBy: "Admin"
                    }
                    : c
            ));
            setDeleteConfirmOpen(false);
            setCompanyToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Company Management</h1>
                    <p className="text-muted-foreground">Manage companies under tenants.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => {
                    setIsAddOpen(open);
                    if (!open) {
                        setEditingCompany(null);
                        form.reset();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openAddDialog}>
                            <Plus className="mr-2 h-4 w-4" /> Add Company
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingCompany ? "Edit Company" : "Add New Company"}</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 py-4">
                                <FormField
                                    control={form.control}
                                    name="tenantId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tenant <span className="text-red-500">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Tenant" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="1">Alpha Corp</SelectItem>
                                                    <SelectItem value="2">Beta Industries</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Name <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Alpha HQ" {...field} required />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Code <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. COMP01" {...field} required />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="gst"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>GST/VAT No <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter GST/VAT" {...field} required />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Country <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. India" {...field} required />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status <span className="text-red-500">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {editingCompany && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <h3 className="font-semibold text-sm text-muted-foreground">Audit Information</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Created At</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingCompany.createdAt}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Created By</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingCompany.createdBy}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Updated At</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingCompany.updatedAt}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Updated By</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingCompany.updatedBy}</div>
                                            </div>
                                            {editingCompany.deletedAt && (
                                                <>
                                                    <div className="grid gap-1">
                                                        <Label className="text-muted-foreground">Deleted At</Label>
                                                        <div className="p-2 bg-muted rounded-md">{editingCompany.deletedAt}</div>
                                                    </div>
                                                    <div className="grid gap-1">
                                                        <Label className="text-muted-foreground">Deleted By</Label>
                                                        <div className="p-2 bg-muted rounded-md">{editingCompany.deletedBy}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={!form.formState.isValid}>
                                        {editingCompany ? "Update Company" : "Create Company"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Companies</CardTitle>
                    <div className="pt-2">
                        <Input
                            placeholder="Search companies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Tenant</TableHead>
                                <TableHead>GST/VAT</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCompanies.map((company) => (
                                <TableRow key={company.id}>
                                    <TableCell className="font-medium">{company.name}</TableCell>
                                    <TableCell>{company.code}</TableCell>
                                    <TableCell>{company.tenant}</TableCell>
                                    <TableCell>{company.gst}</TableCell>
                                    <TableCell>
                                        <Badge variant={company.status === "active" ? "default" : "secondary"}>
                                            {company.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(company)}>Edit</Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={!!company.deletedAt}
                                                onClick={() => handleDeleteClick(company)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will soft-delete the company "{companyToDelete?.name}". The status will be set to inactive.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
