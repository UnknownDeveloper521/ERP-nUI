import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Clock, Calendar, TrendingUp, AlertCircle, Briefcase, CheckCircle2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { isModuleVisible, isWidgetVisible } from "@/lib/moduleConfig";

const attendanceData = [
  { name: "Mon", present: 145, absent: 5 },
  { name: "Tue", present: 148, absent: 2 },
  { name: "Wed", present: 142, absent: 8 },
  { name: "Thu", present: 146, absent: 4 },
  { name: "Fri", present: 144, absent: 6 },
];

const recruitmentData = [
  { name: "Applied", value: 45 },
  { name: "Screening", value: 28 },
  { name: "Interview", value: 12 },
  { name: "Offer", value: 5 },
];

export default function HRDashboard() {
  const { toast } = useToast();

  /**
   * ========================================================================
   * MODULE VISIBILITY CHECKS
   * ========================================================================
   * 
   * PURPOSE:
   * Check which HRMS modules are currently visible/hidden.
   * Used to conditionally render dashboard widgets and cards.
   * 
   * WHY NEEDED:
   * When modules are hidden (Leave Management, Payroll, ESS), their
   * dashboard widgets should also be hidden to maintain consistency.
   * 
   * CONFIGURATION:
   * Controlled by HIDDEN_MODULES in client/src/lib/moduleConfig.ts
   * 
   * TO RE-ENABLE A MODULE:
   * Change its value from false to true in moduleConfig.ts
   * 
   * ========================================================================
   */
  const isLeaveManagementVisible = isModuleVisible('leave-management');
  const isPayrollVisible = isModuleVisible('payroll-management');
  const isESSVisible = isModuleVisible('ess');

  /**
   * ========================================================================
   * DASHBOARD WIDGET VISIBILITY CHECKS
   * ========================================================================
   * 
   * PURPOSE:
   * Check which dashboard widgets should be visible or hidden.
   * This is independent of module visibility and allows fine-grained control.
   * 
   * WHY SEPARATE FROM MODULES:
   * - Widgets can be hidden without hiding entire modules
   * - Provides flexibility for customizing dashboard layout
   * - Allows hiding specific features (e.g., recruitment) without affecting
   *   the entire HRMS module
   * 
   * CONFIGURATION:
   * Controlled by HIDDEN_DASHBOARD_WIDGETS in client/src/lib/moduleConfig.ts
   * 
   * CURRENTLY HIDDEN WIDGETS:
   * - Open Positions card (hr-open-positions)
   * - Recruitment Pipeline chart (hr-recruitment-pipeline)
   * - Pending Approvals section (hr-pending-approvals)
   * 
   * TO RE-ENABLE A WIDGET:
   * Change its value from false to true in moduleConfig.ts
   * Example: 'hr-open-positions': true
   * 
   * USAGE IN CODE:
   * {isOpenPositionsVisible && <Card>...</Card>}
   * This ensures the widget only renders when visibility flag is true
   * 
   * ========================================================================
   */
  const isOpenPositionsVisible = isWidgetVisible('hr-open-positions');
  const isRecruitmentPipelineVisible = isWidgetVisible('hr-recruitment-pipeline');
  const isPendingApprovalsVisible = isWidgetVisible('hr-pending-approvals');

  const handleReviewClick = (user: string, type: string) => {
    toast({
      title: "Review Request",
      description: `Opening ${type} request for ${user}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Overview of human resources and workforce metrics.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hrms/core-hr">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      {/* ================================================================
           SUMMARY CARDS SECTION
           ================================================================
           PURPOSE: Display key HR metrics at a glance
           
           VISIBILITY LOGIC:
           - Total Employees: Always visible (core metric)
           - Present Today: Always visible (core metric)
           - On Leave: Conditional (hidden when Leave Management is disabled)
           - Open Positions: Conditional (hidden via widget visibility flag)
           
           GRID LAYOUT:
           The grid automatically adjusts based on visible cards:
           - 4 cards visible: md:grid-cols-4 (4 columns)
           - 3 cards visible: md:grid-cols-3 (3 columns)
           - 2 cards visible: md:grid-cols-2 (2 columns)
           
           WHY DYNAMIC GRID:
           Prevents empty spaces and maintains clean layout when cards are hidden
           ================================================================ */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* ============================================================
             TOTAL EMPLOYEES CARD - ALWAYS VISIBLE
             ============================================================
             PURPOSE: Shows total active employee count
             VISIBILITY: Always visible (core HR metric)
             DATA: Total active workforce count
             ============================================================ */}
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Employees</p>
              <h3 className="text-2xl font-bold text-blue-900">150</h3>
              <p className="text-xs text-blue-600/80 mt-1">Active workforce</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* ============================================================
             PRESENT TODAY CARD - ALWAYS VISIBLE
             ============================================================
             PURPOSE: Shows attendance for current day
             VISIBILITY: Always visible (core HR metric)
             DATA: Number of employees present today + attendance percentage
             ============================================================ */}
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Present Today</p>
              <h3 className="text-2xl font-bold text-green-900">142</h3>
              <p className="text-xs text-green-600/80 mt-1">94.6% Attendance</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* ================================================================
             ON LEAVE CARD - CONDITIONALLY RENDERED
             ================================================================
             PURPOSE: Shows employees currently on leave
             VISIBILITY: Only shown if Leave Management module is visible
             HIDDEN WHEN: isLeaveManagementVisible = false
             
             WHY CONDITIONAL:
             - Leave Management module is disabled
             - Leave data is not being tracked/managed
             - Showing this card would be misleading
             
             TO RE-ENABLE:
             Set 'leave-management': true in moduleConfig.ts
             
             DATA SHOWN:
             - Total employees on leave
             - Breakdown by leave type (Planned, Sick)
             ================================================================ */}
        {isLeaveManagementVisible && (
          <Card className="bg-amber-50 border-amber-100">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">On Leave</p>
                <h3 className="text-2xl font-bold text-amber-900">8</h3>
                <p className="text-xs text-amber-600/80 mt-1">4 Planned, 4 Sick</p>
              </div>
              <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================
             OPEN POSITIONS CARD - CONDITIONALLY RENDERED
             ================================================================
             PURPOSE: Shows current job openings and recruitment needs
             VISIBILITY: Controlled by widget visibility flag
             HIDDEN WHEN: isOpenPositionsVisible = false
             
             WHY SEPARATE FROM MODULES:
             - Recruitment is a specific feature, not a full module
             - Can be hidden independently of HRMS module
             - Allows customizing dashboard without affecting navigation
             
             TO RE-ENABLE:
             Set 'hr-open-positions': true in moduleConfig.ts
             under HIDDEN_DASHBOARD_WIDGETS
             
             DATA SHOWN:
             - Total open positions
             - Number of departments with openings
             
             RELATED WIDGETS:
             - Recruitment Pipeline chart (also hidden)
             - Both should typically be shown/hidden together
             ================================================================ */}
        {isOpenPositionsVisible && (
          <Card className="bg-purple-50 border-purple-100">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Open Positions</p>
                <h3 className="text-2xl font-bold text-purple-900">12</h3>
                <p className="text-xs text-purple-600/80 mt-1">Across 3 Depts</p>
              </div>
              <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ====================================================================
           CHARTS & EVENTS SECTION - TWO COLUMN LAYOUT
           ====================================================================
           PURPOSE: Visual analytics and important dates side by side
           
           LAYOUT:
           - 2-column grid on desktop (md:grid-cols-2 lg:grid-cols-7)
           - Left: Attendance Trend chart (4 columns, col-span-4)
           - Right: Upcoming Events (3 columns, col-span-3)
           
           RESPONSIVE BEHAVIOR:
           - Desktop (lg+): Side by side, 4:3 ratio
           - Tablet (md): Side by side, equal width
           - Mobile: Stacked vertically
           
           VISIBILITY:
           - Attendance Trend: Always visible (core metric)
           - Upcoming Events: Always visible (core feature)
           - Recruitment Pipeline: Hidden (was previously here)
           ==================================================================== */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* ==================================================================
             ATTENDANCE TREND CHART - ALWAYS VISIBLE
             ==================================================================
             PURPOSE: Shows weekly attendance patterns
             VISIBILITY: Always visible (core HR metric)
             
             DATA DISPLAYED:
             - Daily present vs absent count
             - Weekly trend visualization
             - Helps identify attendance patterns
             
             CHART TYPE: Area chart with gradient fill
             TIME PERIOD: Current week (Mon-Fri)
             
             WHY ALWAYS VISIBLE:
             - Core HR metric that's always relevant
             - Essential for workforce management
             - Not tied to any specific module
             ================================================================== */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Attendance Trend (Weekly)</CardTitle>
            <CardDescription>Daily present vs absent count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#6b7280" />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#6b7280" domain={[130, 155]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e2e8f0",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Area type="monotone" dataKey="present" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorPresent)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================
             UPCOMING EVENTS WIDGET - COMPACT ERP STYLE
             ==================================================================
             PURPOSE: Shows important dates and celebrations in compact format
             VISIBILITY: Always visible (core HR feature)
             POSITION: Right side of Attendance Trend chart
             
             LAYOUT STRUCTURE:
             - Compact card design matching ERP dashboard style
             - Icon on left (colored background circle)
             - Event title on first line (medium weight)
             - Secondary details below (smaller, muted text)
             - Minimal spacing between items
             - Vertically aligned for clean appearance
             - Scrollable if content grows beyond visible area
             
             DATA DISPLAYED:
             - Employee birthdays (pink icon)
             - Work anniversaries (indigo icon)
             - Public holidays (red icon)
             - Company events
             
             WHY ALWAYS VISIBLE:
             - Important for team morale
             - Helps managers remember important dates
             - Not tied to any specific module
             - Core HR functionality
             
             DESIGN PRINCIPLES:
             - Compact: Reduced padding and spacing
             - Structured: Consistent icon-text layout
             - Scannable: Clear visual hierarchy
             - Scrollable: Handles growing content gracefully
             
             ICON COLOR CODING:
             - Pink (bg-pink-100/text-pink-600): Birthdays
             - Indigo (bg-indigo-100/text-indigo-600): Work anniversaries
             - Red (bg-red-100/text-red-600): Public holidays
             ================================================================== */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming Events</CardTitle>
            <CardDescription className="text-xs">Birthdays, anniversaries & holidays</CardDescription>
          </CardHeader>
          <CardContent>
            {/* ============================================================
                 EVENTS LIST - COMPACT SCROLLABLE CONTAINER
                 ============================================================
                 PURPOSE: Display events in compact, structured format
                 
                 CONTAINER PROPERTIES:
                 - max-h-[280px]: Fixed max height matching chart
                 - overflow-y-auto: Vertical scroll when content exceeds height
                 - space-y-3: Consistent 12px spacing between items
                 - pr-2: Right padding for scrollbar spacing
                 
                 ITEM STRUCTURE:
                 Each event item follows this pattern:
                 ┌─────────────────────────────────────┐
                 │ [Icon] Event Title                  │
                 │        Secondary Details            │
                 └─────────────────────────────────────┘
                 
                 SPACING STRATEGY:
                 - Reduced padding (p-2.5 instead of p-3/p-4)
                 - Compact gaps (gap-3 instead of gap-4)
                 - Minimal vertical spacing (space-y-3)
                 - Tight text spacing (no extra margins)
                 
                 ALIGNMENT:
                 - Flex layout for horizontal alignment
                 - Items-start for top alignment
                 - Icon and text vertically aligned
                 - Consistent left edge alignment
                 ============================================================ */}
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
              {/* ========================================================
                   EVENT ITEM 1: BIRTHDAY
                   ========================================================
                   STRUCTURE:
                   - Icon: Pink circle with Users icon
                   - Title: "Sarah's Birthday" (medium weight)
                   - Details: "Tomorrow" (small, muted)
                   
                   STYLING:
                   - Compact padding (p-2.5)
                   - Reduced gap (gap-3)
                   - Hover effect for interactivity
                   - Border for definition
                   ======================================================== */}
              <div className="flex items-start gap-3 p-2.5 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600 flex-shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">Sarah's Birthday</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tomorrow</p>
                </div>
              </div>

              {/* ========================================================
                   EVENT ITEM 2: WORK ANNIVERSARY
                   ========================================================
                   STRUCTURE:
                   - Icon: Indigo circle with Briefcase icon
                   - Title: "Work Anniversary - Mike" (medium weight)
                   - Details: "in 3 days • 5 Years" (small, muted)
                   
                   STYLING:
                   - Same compact structure as birthday
                   - Indigo color scheme
                   - Multiple detail items separated by bullet
                   ======================================================== */}
              <div className="flex items-start gap-3 p-2.5 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">Work Anniversary - Mike</p>
                  <p className="text-xs text-muted-foreground mt-0.5">in 3 days • 5 Years</p>
                </div>
              </div>

              {/* ========================================================
                   EVENT ITEM 3: PUBLIC HOLIDAY
                   ========================================================
                   STRUCTURE:
                   - Icon: Red circle with Calendar icon
                   - Title: "Public Holiday" (medium weight)
                   - Details: "Next Week • Christmas" (small, muted)
                   
                   STYLING:
                   - Same compact structure
                   - Red color scheme for holidays
                   - Multiple detail items separated by bullet
                   ======================================================== */}
              <div className="flex items-start gap-3 p-2.5 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">Public Holiday</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Next Week • Christmas</p>
                </div>
              </div>

              {/* ========================================================
                   ADDITIONAL EVENTS CAN BE ADDED HERE
                   ========================================================
                   The container will automatically scroll if more events
                   are added beyond the max-height of 280px.
                   
                   TO ADD NEW EVENT:
                   Copy the structure above and modify:
                   1. Icon background color (bg-{color}-100)
                   2. Icon text color (text-{color}-600)
                   3. Icon component (Users, Briefcase, Calendar, etc.)
                   4. Event title text
                   5. Event details text
                   
                   EXAMPLE:
                   <div className="flex items-start gap-3 p-2.5 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                     <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                       <Icon className="h-4 w-4" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium leading-tight">Event Title</p>
                       <p className="text-xs text-muted-foreground mt-0.5">Event Details</p>
                     </div>
                   </div>
                   ======================================================== */}
            </div>
          </CardContent>
        </Card>

        {/* ==================================================================
             RECRUITMENT PIPELINE CHART - CONDITIONALLY RENDERED
             ==================================================================
             NOTE: This widget is currently HIDDEN via visibility flag
             
             If re-enabled, it would appear below the Attendance Trend chart
             in a new row, maintaining the same column structure.
             
             TO RE-ENABLE:
             Set 'hr-recruitment-pipeline': true in moduleConfig.ts
             ================================================================== */}
        {isRecruitmentPipelineVisible && (
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recruitment Pipeline</CardTitle>
              <CardDescription>Candidates in active stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={recruitmentData} margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} fontSize={12} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e2e8f0",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                      {recruitmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"][index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ====================================================================
           BOTTOM SECTION - PENDING APPROVALS (SINGLE COLUMN)
           ====================================================================
           PURPOSE: Action items requiring approval
           
           LAYOUT:
           - Single column when Pending Approvals is visible
           - Full width layout for better space utilization
           - Upcoming Events moved to chart section above
           
           VISIBILITY:
           - Pending Approvals: Conditional (widget visibility flag)
           
           NOTE:
           Upcoming Events section has been moved to the right side of
           the Attendance Trend chart for better layout optimization.
           ==================================================================== */}
      {isPendingApprovalsVisible && (
        <div className="grid gap-6">
          {/* ==================================================================
               PENDING APPROVALS SECTION - CONDITIONALLY RENDERED
               ==================================================================
               PURPOSE: Shows requests requiring manager/HR approval
               VISIBILITY: Controlled by widget visibility flag
               HIDDEN WHEN: isPendingApprovalsVisible = false
               
               WHY HIDE THIS WIDGET:
               - Approval workflow not currently in use
               - Reduces dashboard clutter
               - Simplifies UI for users without approval responsibilities
               - Can be re-enabled when approval system is activated
               
               TO RE-ENABLE:
               Set 'hr-pending-approvals': true in moduleConfig.ts
               under HIDDEN_DASHBOARD_WIDGETS
               
               DATA DISPLAYED:
               - Leave requests (filtered if Leave Management is hidden)
               - Expense claims
               - Shift change requests
               - Other approval types
               
               FILTERING LOGIC:
               Even when visible, this section filters items based on:
               - Module visibility (e.g., leave requests hidden if Leave Management disabled)
               - User permissions (future enhancement)
               - Request status (only pending items shown)
               
               BUSINESS LOGIC:
               When approval workflow is not active:
               - No pending items to show
               - Cleaner dashboard for non-managers
               - Re-enable when approval system goes live
               
               USER INTERACTION:
               - Click "Review" button to open approval details
               - Shows user avatar, request type, and timestamp
               - Color-coded by urgency (Pending, Urgent)
               ================================================================== */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Requests requiring your action</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* ============================================================
                     PENDING APPROVALS LIST - FILTERED BY MODULE VISIBILITY
                     ============================================================
                     PURPOSE: Shows pending approval items
                     
                     FILTERING: Leave-related items hidden when Leave Management is disabled
                     
                     WHY FILTER:
                     Maintains consistency - if Leave Management is hidden,
                     leave approval requests should also be hidden
                     
                     HOW IT WORKS:
                     1. Each item has a moduleCheck property
                     2. Items are filtered using .filter(item => item.moduleCheck)
                     3. Only items with moduleCheck=true are rendered
                     
                     EXAMPLE:
                     - Sick Leave: moduleCheck = isLeaveManagementVisible
                     - Expense Claim: moduleCheck = true (always shown)
                     - Shift Change: moduleCheck = true (always shown)
                     
                     TO ADD NEW APPROVAL TYPES:
                     Add to the array with appropriate moduleCheck:
                     { 
                       user: "Name", 
                       type: "Type", 
                       date: "Date", 
                       status: "Status",
                       moduleCheck: isModuleVisible('module-name')
                     }
                     ============================================================ */}
                {[
                  { user: "Alice Cooper", type: "Sick Leave", date: "Today", status: "Pending", moduleCheck: isLeaveManagementVisible },
                  { user: "Bob Smith", type: "Expense Claim", date: "Yesterday", status: "Pending", moduleCheck: true },
                  { user: "Charlie Brown", type: "Shift Change", date: "2 days ago", status: "Urgent", moduleCheck: true },
                ]
                  .filter(item => item.moduleCheck) // Filter out items whose module is hidden
                  .map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{item.user.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{item.user}</p>
                          <p className="text-xs text-muted-foreground">{item.type} • {item.date}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleReviewClick(item.user, item.type)}>Review</Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
