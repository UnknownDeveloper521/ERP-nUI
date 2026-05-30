import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

import { API_BASE_URL } from "@/lib/config";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/verify-email");
  const { toast } = useToast();

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  // Get token from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setVerificationStatus('error');
      setMessage('No verification token provided');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    setIsVerifying(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const result = await response.json();

      if (response.ok && result.verified) {
        setVerificationStatus('success');
        setMessage(result.message);
        
        // If user data is returned, store it for auto-login
        if (result.token && result.user) {
          localStorage.setItem('auth_token', result.token);
          localStorage.setItem('auth_user', JSON.stringify(result.user));
        }

        toast({
          title: "Email Verified!",
          description: "Your account has been activated successfully.",
        });

        // Redirect to login or dashboard after 3 seconds
        setTimeout(() => {
          if(result.token) {
            setLocation("/login");
          }
        }, 3000);

      } else {
        setVerificationStatus('error');
        setMessage(result.message || 'Email verification failed');
        
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: result.message || 'Email verification failed',
        });
      }

    } catch (error: any) {
      setVerificationStatus('error');
      setMessage('Network error. Please try again.');
      
      toast({
        variant: "destructive",
        title: "Network Error",
        description: 'Please check your connection and try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

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

  const renderContent = () => {
    if (isVerifying) {
      return (
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-blue-600" />
          <h1 className="text-2xl font-bold mb-2">Verifying Your Email</h1>
          <p className="text-muted-foreground">Please wait while we verify your email address...</p>
        </div>
      );
    }

    if (verificationStatus === 'success') {
      return (
        <div className="text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
          <h1 className="text-2xl font-bold mb-2 text-green-700">Email Verified Successfully!</h1>
          <p className="text-muted-foreground mb-4">{message}</p>
          <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
          <div className="mt-6">
            <Button variant="outline" onClick={() => setLocation("/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      );
    }

    if (verificationStatus === 'error') {
      return (
        <div className="text-center">
          <XCircle className="h-16 w-16 mx-auto mb-4 text-red-600" />
          <h1 className="text-2xl font-bold mb-2 text-red-700">Verification Failed</h1>
          <p className="text-muted-foreground mb-6">{message}</p>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Need a new verification email?</h3>
              <div className="flex gap-2 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button 
                  onClick={resendVerificationEmail}
                  disabled={isResending}
                  className="whitespace-nowrap"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button variant="outline" onClick={() => setLocation("/register")} className="mr-2">
                Register Again
              </Button>
              <Button variant="outline" onClick={() => setLocation("/login")}>
                Back to Login
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-[600px] overflow-hidden rounded-xl border bg-background p-8 shadow-2xl">
        {renderContent()}
      </div>
    </div>
  );
}
