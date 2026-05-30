import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/store";




export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);


  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // console.log("🔐 Attempting login with:", email);
      const success = await login(email, password);

      if (success) {
        setIsLoading(false);
        // console.log("✅ Login successful for:", email);
        toast({
          variant: "success",
          title: "Login Successful",
          description: `Welcome to ERP!`,
          duration: 15000,
        });
        setTimeout(() => {
          setLocation("/");
        }, 500);
      } else {
        setIsLoading(false);
        console.error("❌ Login failed - invalid credentials or inactive account");
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid credentials or inactive account",
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      console.error("💥 Exception:", err);
      toast({
        variant: "destructive",
        title: "Login Error",
        description: err?.message || "An unexpected error occurred.",
      });
    }
  };



  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="flex w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl">
        {/* Left Side - Brand */}
        <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary to-[#003C7A] p-10 text-primary-foreground lg:flex relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            {/* Abstract pattern or overlay */}
            <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-white blur-3xl"></div>
            <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white blur-3xl"></div>
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
              Streamline Your <br /> Enterprise Operations
            </h1>
            <p className="text-md text-primary-foreground/80">
              Comprehensive ERP solution for managing HR, Sales, Inventory, and Customer relations in one unified platform.
            </p>
          </div>

          <div className="relative z-10 text-sm text-primary-foreground/60">
            <p>Tassos Consultancy Services Private Limited</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 bg-background p-8 lg:p-10 flex flex-col justify-center">
          <div className="mx-auto w-full max-w-md space-y-10">
            <div className="space-y-4 text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight">Welcome to ERP</h2>
              <p className="text-muted-foreground">
                Enter your credentials to access your account
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                  <Label htmlFor="password">Password</Label>
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
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>



              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>


            </form>


          </div>
        </div>
      </div>

    </div>
  );
}
