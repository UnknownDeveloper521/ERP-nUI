import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";

const companySchema = z.object({
    tenantId: z.string().min(1, "Tenant is required"),
    name: z.string().min(1, "Company Name is required"),
    code: z.string().min(1, "Company Code is required"),
    gstVatNo: z.string().min(1, "GST/VAT No is required"),
    country: z.string().min(1, "Country is required"),
    status: z.enum(["active", "inactive"], {
        required_error: "Status is required",
    }),
});

// Mock tenants for dropdown
const mockTenants = [
    { id: "1", name: "Acme Corp" },
    { id: "2", name: "Globex" },
    { id: "3", name: "Soylent Corp" },
];

export function AddCompanyModal() {
    const [open, setOpen] = useState(false);

    const form = useForm<z.infer<typeof companySchema>>({
        resolver: zodResolver(companySchema),
        mode: "onChange",
        defaultValues: {
            tenantId: "",
            name: "",
            code: "",
            gstVatNo: "",
            country: "",
            status: "active",
        },
    });

    function onSubmit(values: z.infer<typeof companySchema>) {
        console.log(values);
        toast.success("Company created successfully (Frontend only)");
        setOpen(false);
        form.reset();
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Add New Company</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Company</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="tenantId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Tenant <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select tenant" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {mockTenants.map((tenant) => (
                                                <SelectItem key={tenant.id} value={tenant.id}>
                                                    {tenant.name}
                                                </SelectItem>
                                            ))}
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
                                    <FormLabel>
                                        Company Name <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter company name" {...field} required />
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
                                    <FormLabel>
                                        Company Code <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter company code" {...field} required />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="gstVatNo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        GST/VAT No <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter GST/VAT No" {...field} required />
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
                                    <FormLabel>
                                        Country <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter country" {...field} required />
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
                                    <FormLabel>
                                        Status <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
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
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={!form.formState.isValid}>
                                Create Company
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
