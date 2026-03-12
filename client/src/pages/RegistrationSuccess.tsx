import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle, Loader2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default function RegistrationSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  // Get email from URL params if available
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email');

  useState(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  });

  const resendVerificationEmail = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address to resend verification.",
      });
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Email Sent!",
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Send",
          description: result.message,
        });
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-[600px] overflow-hidden rounded-xl border bg-background p-8 shadow-2xl">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
          <h1 className="text-2xl font-bold mb-2 text-green-700">Registration Successful!</h1>
          <p className="text-muted-foreground mb-6">
            We've sent a verification email to your inbox. Please check your email and click the verification link to activate your account.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <Mail className="h-5 w-5 text-blue-600 mr-2" />
              <span className="font-semibold text-blue-800">Check Your Email</span>
            </div>
            <p className="text-sm text-blue-700">
              Look for an email from ERP System with the subject "Verify Your Email Address". 
              Don't forget to check your spam folder if you don't see it in your inbox.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">Didn't receive the email?</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="resend-email">Enter your email to resend verification</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    placeholder="your-email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={resendVerificationEmail}
                  disabled={isResending}
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending Verification Email...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="pt-6 border-t space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Already verified your email?
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setLocation("/login")}>
                  Go to Login
                </Button>
                <Button variant="outline" onClick={() => setLocation("/register")}>
                  Register Different Account
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">Troubleshooting Tips:</h4>
            <ul className="text-sm text-gray-600 text-left space-y-1">
              <li>• Check your spam/junk folder</li>
              <li>• Make sure you entered the correct email address</li>
              <li>• The verification link expires in 24 hours</li>
              <li>• Contact support if you continue having issues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
