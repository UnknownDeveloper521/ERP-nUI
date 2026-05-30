import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { profileApi, type UserProfileRecord } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { resolveFileUrl } from "@/lib/utils";

export default function MyAccount() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await profileApi.getMyProfile();
        if (response.isSuccessful && response.data.records && response.data.records.length > 0) {
          setProfileData(response.data.records[0]);
        } else {
          setError(response.message || "Failed to fetch profile information.");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred while loading your profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const calculateAge = (dob: string | null | undefined) => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      if (isNaN(birthDate.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return null;
    }
  };

  const getFullName = (data: UserProfileRecord) => {
    const parts = [data.first_name, data.middle_name, data.last_name].filter(Boolean);
    return parts.join(" ");
  };

  if (!user) return <div className="p-8 text-center">Please log in to view your profile.</div>;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading your profile...</p>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "Could not load profile data. Please try again later."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const fullName = getFullName(profileData);
  const age = calculateAge(profileData.date_of_birth);

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="flex flex-col gap-6 pb-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center sm:flex-row gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileData.photo_url ? resolveFileUrl(profileData.photo_url) : ""} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {profileData.first_name.charAt(0)}{profileData.last_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="font-bold text-2xl">{fullName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {profileData.designation_name || "N/A"} • {profileData.department_name || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">Employee Code: {profileData.employee_code}</p>
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
                  <Input value={profileData.first_name} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Middle Name</Label>
                  <Input value={profileData.middle_name || "N/A"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Name</Label>
                  <Input value={profileData.last_name} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gender</Label>
                  <Input value={profileData.gender_name || "N/A"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</Label>
                  <Input value={profileData.date_of_birth ? new Date(profileData.date_of_birth).toLocaleDateString('en-GB') : "N/A"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Age</Label>
                  <Input value={age !== null ? `${age} years` : "N/A"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Marital Status</Label>
                  <Input value={profileData.marital_status_name || "N/A"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nationality</Label>
                  <Input value={profileData.nationality_name || "N/A"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blood Group</Label>
                  <Input value={profileData.blood_group_name || "N/A"} readOnly className="bg-muted" />
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
                  <Input value={profileData.mobile_number} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alternate Mobile</Label>
                  <Input value={profileData.alternate_mobile || "N/A"} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Personal Email</Label>
                  <Input value={profileData.personal_email} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Official Email</Label>
                  <Input value={profileData.official_email} readOnly className="bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
