import React, { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * LeaveApplication Interface
 * Defines the structure of a leave application record
 */
interface LeaveApplication {
  id: string;              // Unique identifier for the leave
  employeeCode: string;    // Employee code
  employeeName: string;    // Employee name
  leaveType: string;       // Type of leave (Paid, Sick, Casual, Annual, Unpaid)
  fromDate: string;        // Start date of leave (ISO format)
  toDate: string;          // End date of leave (ISO format)
  paidLeave: boolean;      // Whether the leave is paid
  remark: string;          // Additional notes/remarks
}

/**
 * ImprovedLeaveCalendarProps Interface
 * Props passed to the ImprovedLeaveCalendar component
 */
interface ImprovedLeaveCalendarProps {
  currentDate: Date;                              // Current month/year to display
  leaveApplications: LeaveApplication[];          // Array of all leave applications
  employees: string[];                            // List of employee names to display
  leaveTypeColors: { [key: string]: string };     // Color mapping for each leave type
}

/**
 * ImprovedLeaveCalendar Component
 * 
 * Displays a timeline-style calendar showing employee leaves for a month.
 * Features:
 * - Single weekday header row at the top
 * - Each employee row shows date numbers (1-31) with leave indicators
 * - Multi-day leaves render as continuous horizontal strips
 * - Single-day leaves render as circular badges
 * - Hover tooltips show leave details
 * 
 * @param currentDate - The month/year to display
 * @param leaveApplications - All leave records to render
 * @param employees - List of employees to show in rows
 * @param leaveTypeColors - Color codes for different leave types
 */
export default function ImprovedLeaveCalendar({
  currentDate,
  leaveApplications,
  employees,
  leaveTypeColors,
}: ImprovedLeaveCalendarProps) {
  // State to track which leave is currently being hovered for tooltip display
  const [hoveredLeave, setHoveredLeave] = useState<{
    leave: LeaveApplication;
    x: number;  // X coordinate for tooltip positioning
    y: number;  // Y coordinate for tooltip positioning
  } | null>(null);

  // Extract year, month, and calculate days in the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Get today's date with time normalized to midnight for accurate comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /**
   * Generate array of Date objects for each day in the month
   * Each date is normalized to midnight (00:00:00) for consistent comparisons
   */
  const monthDates: Date[] = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month, i + 1);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  /**
   * Weekday abbreviations starting with Monday
   * Used in the calendar header row
   */
  const weekdayAbbr = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  /**
   * Get employee initials for avatar display
   * Takes first letter of first name and first letter of last name
   * Falls back to first 2 characters if only one name part exists
   * 
   * @param name - Full employee name
   * @returns Two-letter uppercase initials
   */
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  /**
   * Generate a consistent color for employee avatar based on their name
   * Uses character code sum to deterministically select from color palette
   * 
   * @param name - Employee name
   * @returns Hex color code
   */
  const getAvatarColor = (name: string) => {
    const colors = [
      '#3b82f6', '#10b981', '#8b5cf6', '#ec4899',
      '#f59e0b', '#6366f1', '#ef4444', '#14b8a6',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  /**
   * Filter leave applications for a specific employee
   * 
   * @param employeeName - Name of the employee
   * @returns Array of leave applications for that employee
   */
  const getEmployeeLeavesForMonth = (employeeName: string) => {
    return leaveApplications.filter(app => `${app.employeeCode} - ${app.employeeName}` === employeeName || app.employeeName === employeeName);
  };

  /**
   * Check if a specific date falls within a leave period
   * Normalizes all dates to midnight for accurate comparison
   * 
   * @param leave - Leave application to check
   * @param date - Date to check against
   * @returns true if date is within leave range (inclusive)
   */
  const isDateInLeave = (leave: LeaveApplication, date: Date) => {
    const fromDate = new Date(leave.fromDate);
    const toDate = new Date(leave.toDate);
    const checkDate = new Date(date);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate >= fromDate && checkDate <= toDate;
  };

  /**
   * Check if a date is the start date of a leave period
   * Used to determine where to apply rounded-left edge on leave strip
   * 
   * @param leave - Leave application to check
   * @param date - Date to check
   * @returns true if date matches leave start date
   */
  const isLeaveStart = (leave: LeaveApplication, date: Date) => {
    const fromDate = new Date(leave.fromDate);
    const checkDate = new Date(date);
    fromDate.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);
    return fromDate.getTime() === checkDate.getTime();
  };

  /**
   * Check if a date is the end date of a leave period
   * Used to determine where to apply rounded-right edge on leave strip
   * 
   * @param leave - Leave application to check
   * @param date - Date to check
   * @returns true if date matches leave end date
   */
  const isLeaveEnd = (leave: LeaveApplication, date: Date) => {
    const toDate = new Date(leave.toDate);
    const checkDate = new Date(date);
    toDate.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);
    return toDate.getTime() === checkDate.getTime();
  };

  /**
   * Format date string for display in tooltip
   * Converts ISO date string to readable format (DD MMM YYYY)
   * 
   * @param dateString - ISO format date string
   * @returns Formatted date string or "—" if invalid
   */
  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-4" style={{ marginRight: '16px' }}>
      {/* Main Calendar Container - White background with rounded corners */}
      <div className="bg-white rounded-lg overflow-hidden">
        {/* Horizontal scroll container for wide calendars */}
        <div className="overflow-x-auto" style={{ paddingBottom: '20px', marginBottom: '-8px' }}>
          <div className="min-w-full inline-block" style={{ marginBottom: '8px' }}>
            
            {/* ===== HEADER ROW - Weekdays Only ===== */}
            {/* Sticky header that stays visible when scrolling vertically */}
            {/* ===== HEADER ROW - Weekdays Only ===== */}
            {/* Sticky header that stays visible when scrolling vertically */}
            <div 
              className="border-b border-gray-200 sticky top-0 bg-gray-50 z-30"
              style={{
                display: 'grid',
                gridTemplateColumns: `150px repeat(${daysInMonth}, minmax(18px, 1fr))`
              }}
            >
              {/* Sticky employee column label */}
              <div className="flex-shrink-0 px-3 py-2 border-r border-gray-200 sticky left-0 bg-gray-50 z-40">
                <span className="text-xs font-semibold text-gray-700">Employee</span>
              </div>
              
              {/* Weekday headers (Mo, Tu, We, etc.) */}
              {monthDates.map((date, index) => {
                // Calculate weekday (0=Sunday, 6=Saturday) and adjust to start with Monday
                const dayOfWeek = weekdayAbbr[(date.getDay() + 6) % 7];
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                
                return (
                  <div
                    key={`weekday-${index}`}
                    className="text-center py-2 border-r border-gray-100 last:border-r-0"
                  >
                    <div className={cn(
                      "text-[9px] font-semibold uppercase",
                      isWeekend ? "text-red-500" : "text-gray-600"  // Red for weekends
                    )}>
                      {dayOfWeek}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ===== EMPLOYEE ROWS ===== */}
            {/* Each row represents one employee with their leave indicators */}
            {employees.map((employee, empIndex) => {
              // Get all leaves for this specific employee
              const employeeLeaves = getEmployeeLeavesForMonth(employee);

              return (
                <div 
                  key={`emp-${empIndex}`} 
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `150px repeat(${daysInMonth}, minmax(18px, 1fr))`
                  }}
                >
                  {/* ===== EMPLOYEE INFO COLUMN ===== */}
                  {/* Sticky column that stays visible when scrolling horizontally */}
                  <div className="flex-shrink-0 px-3 py-3 flex items-center gap-2 bg-white sticky left-0 z-10 border-r border-gray-100 group-hover:bg-gray-50/80">
                    {/* Avatar circle with employee initials */}
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: getAvatarColor(employee) }}
                    >
                      {getInitials(employee)}
                    </div>
                    
                    {/* Employee name with text truncation */}
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {employee}
                    </span>
                  </div>

                    {/* ===== DATE CELLS WITH LEAVE INDICATORS ===== */}
                    {/* One cell for each day of the month */}
                    {monthDates.map((date, dateIndex) => {
                      // Determine date characteristics
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const isToday = date.toDateString() === today.toDateString();
                      
                      // Check if this employee has leave on this date
                      const activeLeave = employeeLeaves.find(leave => isDateInLeave(leave, date));
                      const isStart = activeLeave && isLeaveStart(activeLeave, date);
                      const isEnd = activeLeave && isLeaveEnd(activeLeave, date);
                      const isSingleDay = isStart && isEnd;  // Single-day leave

                      return (
                        <div
                          key={`cell-${empIndex}-${dateIndex}`}
                          className={cn(
                            "flex flex-col items-center justify-center relative py-3 border-r border-gray-50 last:border-r-0 h-14",
                            isWeekend && "bg-gray-50/50"
                          )}
                        >
                          {/* ===== DATE NUMBER ===== */}
                          {/* Always visible, positioned above leave indicator */}
                          {/* ===== DATE NUMBER ===== */}
                          {/* Visible only if NOT on leave; if on leave, it's rendered inside the leave indicator */}
                          {!activeLeave && (
                            <div className={cn(
                              "text-[11px] font-medium relative z-10",
                              isToday && "text-blue-600 font-bold",           // Blue for today
                              !isToday && isWeekend && "text-red-600",        // Red for weekends
                              !isToday && !isWeekend && "text-gray-700"       // Gray for regular days
                            )}>
                              {date.getDate()}
                            </div>
                          )}

                          {/* ===== LEAVE INDICATOR ===== */}
                          {/* Renders as continuous strip for multi-day or circle for single-day */}
                          {activeLeave && (
                            <div
                              className={cn(
                                "absolute flex items-center justify-center cursor-pointer transition-all",
                                // Single-day leave: Rounded pill/capsule
                                isSingleDay 
                                  ? "inset-y-2 inset-x-0.5 rounded-full hover:scale-105" 
                                  // Multi-day leave: strip spanning full cell width
                                  : "inset-y-2 inset-x-0 hover:opacity-90",
                                // Rounded edges only on start/end of multi-day leave
                                isStart && !isSingleDay && "rounded-l-full",
                                isEnd && !isSingleDay && "rounded-r-full"
                              )}
                              style={{ 
                                backgroundColor: leaveTypeColors[activeLeave.leaveType] || '#8b5cf6',
                                opacity: isSingleDay ? 1 : 0.85  // Full opacity for circles, 85% for strips
                              }}
                              // Tooltip handlers
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredLeave({
                                  leave: activeLeave,
                                  x: rect.left + rect.width / 2,  // Center horizontally
                                  y: rect.top - 10                 // Position above element
                                });
                              }}
                              onMouseLeave={() => setHoveredLeave(null)}
                            >
                              {/* Date number always visible inside all active leave days */}
                              {activeLeave && (
                                <span className="text-white text-[10px] font-bold">
                                  {date.getDate()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
        </div>
      </div>

      {/* ===== HOVER TOOLTIP ===== */}
      {/* Displays leave details when hovering over a leave indicator */}
      {hoveredLeave && (
        <div 
          className="fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-xl p-3 w-80 pointer-events-none"
          style={{ 
            left: hoveredLeave.x,
            top: hoveredLeave.y,
            transform: 'translate(-50%, -100%)'  // Center horizontally, position above cursor
          }}
        >
          <div className="space-y-2 text-xs">
            {/* Employee name header */}
            <div className="font-bold text-sm border-b pb-1.5 text-gray-900 break-words">
              {`${hoveredLeave.leave.employeeCode} - ${hoveredLeave.leave.employeeName}`}
            </div>
            
            {/* Leave details grid */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-gray-600">Leave Type:</span>
              <span className="font-semibold text-gray-900 break-words">{hoveredLeave.leave.leaveType}</span>

              <span className="text-gray-600">From:</span>
              <span className="text-gray-900">{formatDateTime(hoveredLeave.leave.fromDate)}</span>

              <span className="text-gray-600">To:</span>
              <span className="text-gray-900">{formatDateTime(hoveredLeave.leave.toDate)}</span>

              <span className="text-gray-600">Paid:</span>
              <span className="text-gray-900">{hoveredLeave.leave.paidLeave ? 'Yes' : 'No'}</span>
            </div>
            
            {/* Optional remark section */}
            {hoveredLeave.leave.remark && (
              <div className="pt-1.5 border-t">
                <span className="text-gray-600">Remark:</span>
                <p className="mt-0.5 text-gray-900 break-words" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{hoveredLeave.leave.remark}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
