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

const tenantSchema = z.object({
    name: z.string().min(1, "Tenant Name is required"),
    code: z.string().min(1, "Tenant Code is required"),
    subdomain: z.string().optional(),
    currency: z.string().min(1, "Currency is required"),
    status: z.enum(["active", "inactive"], {
        required_error: "Status is required",
    }),
});

export function AddTenantModal() {
    const [open, setOpen] = useState(false);

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

    function onSubmit(values: z.infer<typeof tenantSchema>) {
        console.log(values);
        toast.success("Tenant created successfully (Frontend only)");
        setOpen(false);
        form.reset();
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Add New Tenant</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Tenant</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Tenant Name <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter tenant name" {...field} required />
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
                                        Tenant Code <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter tenant code" {...field} required />
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
                                    <FormControl>
                                        <Input placeholder="Enter subdomain" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Currency <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter currency (e.g. USD)" {...field} required />
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
                                Create Tenant
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
