// ============================================================================
// QUALITY CHECK DASHBOARD
// ============================================================================
// Main dashboard for the Quality Check module
// Provides overview of QC operations and quick access to sub-modules
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, TrendingUp } from "lucide-react";

export default function QualityCheckDashboard() {
  // Mock statistics - in production, these would come from API
  const stats = {
    pendingQC: 3,
    verifiedToday: 5,
    totalThisMonth: 45,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Quality Check Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of quality control operations and batch verification status
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending QC</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingQC}</div>
            <p className="text-xs text-muted-foreground">
              Batches awaiting verification
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.verifiedToday}</div>
            <p className="text-xs text-muted-foreground">
              Batches passed QC today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Total batches verified
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent QC Activity</CardTitle>
          <CardDescription>Latest batch verifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="font-medium">BATCH-2024-005</p>
                <p className="text-sm text-muted-foreground">Lead Generation & Purification</p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Verified</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="font-medium">BATCH-2024-004</p>
                <p className="text-sm text-muted-foreground">Assembly line & Packaging</p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Verified</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">BATCH-2024-003</p>
                <p className="text-sm text-muted-foreground">Grid Creation & Oxidization</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
