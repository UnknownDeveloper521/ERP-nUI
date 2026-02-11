import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Fallback icons to avoid extra dependencies
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
);

const MicrosoftIcon = () => (
  <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="microsoft" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"></path></svg>
);

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("🔐 Attempting login with:", email);
      const success = await login(email, password);

      if (success) {
        setIsLoading(false);
        console.log("✅ Login successful for:", email);
        toast({
          title: "Login Successful",
          description: `Welcome back!`,
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

  const handleForgotPassword = () => {
    if (!resetEmail) {
      toast({ variant: "destructive", title: "Error", description: "Please enter your email address." });
      return;
    }
    // Simulate sending reset email
    toast({
      title: "Reset Link Sent",
      description: `If an account exists for ${resetEmail}, we have sent a password reset link.`
    });
    setIsForgotPasswordOpen(false);
    setResetEmail("");
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
            <p className="text-lg text-primary-foreground/80">
              Comprehensive ERP solution for managing HR, Sales, Inventory, and Customer relations in one unified platform.
            </p>
          </div>

          <div className="relative z-10 text-sm text-primary-foreground/60">
            <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} Tassos Consultancy Services. All rights reserved.</p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 bg-background p-8 lg:p-10 flex flex-col justify-center">
          <div className="mx-auto w-full max-w-md space-y-6">
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
              <p className="text-muted-foreground">
                Enter your credentials to access your account
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
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
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="font-normal">Remember me for 30 days</Label>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setLocation("/register")}
              >
                New here? Create an account
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-11" onClick={() => setLocation("/")}>
                <GoogleIcon />
                Google
              </Button>
              <Button variant="outline" className="h-11" onClick={() => setLocation("/")}>
                <MicrosoftIcon />
                Microsoft
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="name@company.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleForgotPassword}>Send Reset Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
