import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export default function SuperAdminLogin() {
    const [, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Mock Authentication
        setTimeout(() => {
            setIsLoading(false);
            if (email === "admin@super.com" && password === "admin") {
                toast({
                    title: "Login Successful",
                    description: "Welcome to Super Admin Portal",
                });
                setLocation("/super-admin");
            } else {
                toast({
                    variant: "destructive",
                    title: "Login Failed",
                    description: "Invalid credentials (Try: admin@super.com / admin)",
                });
            }
        }, 1000);
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4">
            <div className="flex w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl bg-white">
                {/* Left Side - Brand */}
                <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-10 text-white lg:flex relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-500 blur-3xl"></div>
                        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-600 blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        <img
                            src="https://tassosconsultancy.com/wp-content/uploads/2025/11/TCS-LOGO-TRACED-PNG.webp"
                            alt="Tassos ERP"
                            className="h-12 w-auto brightness-0 invert"
                        />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <h1 className="text-4xl font-bold leading-tight">
                            Super Admin <br /> Portal
                        </h1>
                        <p className="text-lg text-slate-300">
                            Manage tenants, companies, and system-wide configurations from a central dashboard.
                        </p>
                    </div>

                    <div className="relative z-10 text-sm text-slate-500">
                        <p>Tassos Consultancy Services</p>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full lg:w-1/2 p-8 lg:p-10 flex flex-col justify-center">
                    <div className="mx-auto w-full max-w-md space-y-6">
                        <div className="space-y-2 text-center lg:text-left">
                            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Sign In</h2>
                            <p className="text-slate-500">
                                Enter your super admin credentials
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@super.com"
                                    required
                                    className="h-11"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="h-11 pr-10"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isLoading}>
                                {isLoading ? "Signing in..." : "Sign In"}
                            </Button>
                        </form>
                        <div className="mt-4 text-center text-sm text-slate-500">
                            <p>Use <strong>admin@super.com</strong> / <strong>admin</strong> to login</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
