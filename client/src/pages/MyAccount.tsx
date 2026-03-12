import React, { useState } from "react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Briefcase } from "lucide-react";

// Mock employee data - In production, fetch from CoreHR API
const mockEmployeeData = {
  // Personal Details
  employeeId: "EMP001",
  firstName: "Shubham",
  middleName: "Kumar",
  lastName: "Rajpara",
  fullName: "Shubham Kumar Rajpara",
  gender: "Male",
  dateOfBirth: "1995-05-15",
  age: 29,
  maritalStatus: "Single",
  nationality: "Indian",
  bloodGroup: "O+",
  photo: "", // Employee photo URL
  
  // Contact Information
  mobileNumber: "+91 9876543210",
  alternateMobile: "+91 9876543211",
  personalEmail: "shubhamirajpara.tassos@outlook.com",
  officialEmail: "shubham.rajpara@company.com",
  
  // Address Information
  currentAddress: "123 Main Street, Jinja",
  permanentAddress: "456 Home Street, Kampala",
  city: "Jinja",
  state: "Central Region",
  pincode: "12345",
  country: "Uganda",
  
  // Employment & Job Details
  dateOfJoining: "2024-01-15",
  employmentType: "Full-time",
  employmentStatus: "Active",
  
  // Organization Details
  department: "Engineering",
  designation: "Software Engineer",
  grade: "A",
  reportingManager: "John Manager",
  workLocation: "Jinja Office",
  shift: "General Shift (9 AM - 6 PM)",
};

export default function MyAccount() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!user) return <div>Please log in</div>;

  const handlePasswordReset = () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    // In production, call API to verify current password and update
    toast({
      title: "Success",
      description: "Your password has been reset successfully.",
    });
    
    // Clear form
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
        <p className="text-muted-foreground">
          Manage your profile settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full flex-1 flex flex-col min-h-0">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
            >
              Security
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="profile" className="m-0 pt-6 h-full min-h-0 overflow-auto">
          <div className="flex flex-col gap-6">
            {/* Profile Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center sm:flex-row gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={mockEmployeeData.photo} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {mockEmployeeData.firstName.charAt(0)}{mockEmployeeData.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="font-bold text-2xl">{mockEmployeeData.fullName}</h3>
                    <p className="text-sm text-muted-foreground">{mockEmployeeData.designation} • {mockEmployeeData.department}</p>
                    <p className="text-xs text-muted-foreground">Employee ID: {mockEmployeeData.employeeId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>Personal Details</CardTitle>
                </div>
                <CardDescription>
                  Your personal information from HR records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">First Name</Label>
                    <Input value={mockEmployeeData.firstName} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Middle Name</Label>
                    <Input value={mockEmployeeData.middleName} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Name</Label>
                    <Input value={mockEmployeeData.lastName} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gender</Label>
                    <Input value={mockEmployeeData.gender} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</Label>
                    <Input value={new Date(mockEmployeeData.dateOfBirth).toLocaleDateString('en-GB')} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Age</Label>
                    <Input value={`${mockEmployeeData.age} years`} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Marital Status</Label>
                    <Input value={mockEmployeeData.maritalStatus} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nationality</Label>
                    <Input value={mockEmployeeData.nationality} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blood Group</Label>
                    <Input value={mockEmployeeData.bloodGroup} readOnly className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mobile Number</Label>
                    <Input value={mockEmployeeData.mobileNumber} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alternate Mobile</Label>
                    <Input value={mockEmployeeData.alternateMobile} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Personal Email</Label>
                    <Input value={mockEmployeeData.personalEmail} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Official Email</Label>
                    <Input value={mockEmployeeData.officialEmail} readOnly className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle>Address Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Address</Label>
                    <Input value={mockEmployeeData.currentAddress} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Permanent Address</Label>
                    <Input value={mockEmployeeData.permanentAddress} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</Label>
                    <Input value={mockEmployeeData.city} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">State</Label>
                    <Input value={mockEmployeeData.state} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pincode</Label>
                    <Input value={mockEmployeeData.pincode} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Country</Label>
                    <Input value={mockEmployeeData.country} readOnly className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employment & Job Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Employment & Job Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Joining</Label>
                    <Input value={new Date(mockEmployeeData.dateOfJoining).toLocaleDateString('en-GB')} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employment Type</Label>
                    <Input value={mockEmployeeData.employmentType} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employment Status</Label>
                    <Input value={mockEmployeeData.employmentStatus} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Department</Label>
                    <Input value={mockEmployeeData.department} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Designation</Label>
                    <Input value={mockEmployeeData.designation} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Grade</Label>
                    <Input value={mockEmployeeData.grade} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reporting Manager</Label>
                    <Input value={mockEmployeeData.reportingManager} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Work Location</Label>
                    <Input value={mockEmployeeData.workLocation} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Shift</Label>
                    <Input value={mockEmployeeData.shift} readOnly className="bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="security" className="m-0 pt-6 h-full min-h-0 overflow-auto">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Password Reset</CardTitle>
              <CardDescription>
                Change your account password. Make sure to use a strong password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input 
                    id="current-password" 
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input 
                    id="new-password" 
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input 
                    id="confirm-password" 
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  Password requirements:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  <li>Minimum 8 characters</li>
                  <li>At least one uppercase letter</li>
                  <li>At least one lowercase letter</li>
                  <li>At least one number</li>
                  <li>At least one special character</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handlePasswordReset} 
                disabled={!currentPassword || !newPassword || !confirmPassword}
                className="w-full sm:w-auto"
              >
                Reset Password
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
