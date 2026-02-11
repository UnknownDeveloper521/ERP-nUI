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
const MOCK_TENANTS = [
    { id: "1", code: "T001", name: "Alpha Corp", subdomain: "alpha", status: "active", currency: "USD", createdAt: "2024-01-15", createdBy: "Admin", updatedAt: "2024-01-20", updatedBy: "Admin", deletedAt: null, deletedBy: null },
    { id: "2", code: "T002", name: "Beta Industries", subdomain: "beta", status: "active", currency: "EUR", createdAt: "2024-02-01", createdBy: "System", updatedAt: "2024-02-05", updatedBy: "Admin", deletedAt: null, deletedBy: null },
    { id: "3", code: "T003", name: "Gamma Services", subdomain: "gamma", status: "inactive", currency: "INR", createdAt: "2024-03-10", createdBy: "Admin", updatedAt: "2024-03-11", updatedBy: "Manager", deletedAt: null, deletedBy: null },
];

type Tenant = {
    id: string;
    code: string;
    name: string;
    subdomain: string;
    status: string;
    currency: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deletedAt: string | null;
    deletedBy: string | null;
};

const tenantSchema = z.object({
    name: z.string().min(1, "Tenant Name is required"),
    code: z.string().min(1, "Tenant Code is required"),
    subdomain: z.string().optional(),
    currency: z.string().min(1, "Currency is required"),
    status: z.enum(["active", "inactive"], {
        required_error: "Status is required",
    }),
});

export default function TenantManagement() {
    const [tenants, setTenants] = useState<Tenant[]>(MOCK_TENANTS);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState<any>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [tenantToDelete, setTenantToDelete] = useState<any>(null);

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const form = useForm<z.infer<typeof tenantSchema>>({
        resolver: zodResolver(tenantSchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            code: "",
            subdomain: "",
            currency: "",
            status: "active",
        },
    });

    const onFormSubmit = (data: z.infer<typeof tenantSchema>) => {
        // Logic to add/update tenant would go here
        console.log("Submitted:", data);
        toast.success(editingTenant ? "Tenant updated" : "Tenant created");
        setIsAddOpen(false);
        setEditingTenant(null);
        form.reset();
    };

    const handleAddTenant = (e: React.FormEvent) => {
        // Deprecated, keeping structure but using onFormSubmit
        e.preventDefault();
    };

    const openAddDialog = () => {
        setEditingTenant(null);
        setIsAddOpen(true);
    };

    const openEditDialog = (tenant: any) => {
        setEditingTenant(tenant);
        setIsAddOpen(true);
    };

    const handleDeleteClick = (tenant: any) => {
        setTenantToDelete(tenant);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = () => {
        if (tenantToDelete) {
            setTenants(tenants.map(t =>
                t.id === tenantToDelete.id
                    ? {
                        ...t,
                        status: "inactive",
                        deletedAt: new Date().toISOString(),
                        deletedBy: "Admin"
                    }
                    : t
            ));
            setDeleteConfirmOpen(false);
            setTenantToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tenant Management</h1>
                    <p className="text-muted-foreground">Manage multi-tenant environments.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => {
                    setIsAddOpen(open);
                    if (!open) {
                        setEditingTenant(null);
                        form.reset();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openAddDialog}>
                            <Plus className="mr-2 h-4 w-4" /> Add Tenant
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingTenant ? "Edit Tenant" : "Add New Tenant"}</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 py-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tenant Name <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Acme Corp" {...field} required />
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
                                            <FormLabel>Tenant Code <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. T001" {...field} required />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="subdomain"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subdomain</FormLabel>
                                            <div className="flex items-center">
                                                <FormControl>
                                                    <Input placeholder="acme" {...field} className="rounded-r-none" />
                                                </FormControl>
                                                <div className="bg-muted px-3 py-2 border border-l-0 rounded-r-md text-sm text-muted-foreground">.app.com</div>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="currency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Currency <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. USD, INR" {...field} required />
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

                                {editingTenant && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <h3 className="font-semibold text-sm text-muted-foreground">Audit Information</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Created At</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingTenant.createdAt}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Created By</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingTenant.createdBy}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Updated At</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingTenant.updatedAt}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <Label className="text-muted-foreground">Updated By</Label>
                                                <div className="p-2 bg-muted rounded-md">{editingTenant.updatedBy}</div>
                                            </div>
                                            {editingTenant.deletedAt && (
                                                <>
                                                    <div className="grid gap-1">
                                                        <Label className="text-muted-foreground">Deleted At</Label>
                                                        <div className="p-2 bg-muted rounded-md">{editingTenant.deletedAt}</div>
                                                    </div>
                                                    <div className="grid gap-1">
                                                        <Label className="text-muted-foreground">Deleted By</Label>
                                                        <div className="p-2 bg-muted rounded-md">{editingTenant.deletedBy}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={!form.formState.isValid}>
                                        {editingTenant ? "Update Tenant" : "Create Tenant"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Tenants</CardTitle>
                    <div className="pt-2">
                        <Input
                            placeholder="Search tenants..."
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
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Subdomain</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTenants.map((tenant) => (
                                <TableRow key={tenant.id}>
                                    <TableCell className="font-medium">{tenant.code}</TableCell>
                                    <TableCell>{tenant.name}</TableCell>
                                    <TableCell>{tenant.subdomain}.app.com</TableCell>
                                    <TableCell>
                                        <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                                            {tenant.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{tenant.createdAt}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(tenant)}>Edit</Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={!!tenant.deletedAt}
                                                onClick={() => handleDeleteClick(tenant)}
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
                            This will soft-delete the tenant "{tenantToDelete?.name}". The status will be set to inactive.
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
