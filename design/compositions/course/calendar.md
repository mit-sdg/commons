# Calendar and dashboards

The [calendar former](former:Course.calendar.theCalendarBetween) selects published assignments
whose availability or due date falls inside a requested inclusive window.
[Course.calendar.CalendarMe](reaction:Course.calendar.CalendarMe) gives that calendar to an active student, while
[Course.calendar.CalendarStaff](reaction:Course.calendar.CalendarStaff) gives it to a caller with staff-calendar
or roster-management capability. Neither result is filtered by a student's
releases or section.

[Course.calendar.LmsMe](reaction:Course.calendar.LmsMe) forms
[the calling student's dashboard seat](former:Course.calendar.theDashboardSeatOf).
[Course.calendar.LmsStaffDashboard](reaction:Course.calendar.LmsStaffDashboard) instead requires roster-management
capability and combines [the active-member dashboard](former:Course.calendar.theStaffDashboard)
with [current assignment, grade-item, and late-day counts](former:Course.calendar.theStaffDashboardCounts).

These are read-time joins over Rostering, Assigning, Itemizing, and Banking.
Publishing or archiving work, changing seats or grade items, and canceling late
days changes the next result without copied dashboard state.

```endpoints
Course.calendar.CalendarMe at /calendar/me
Course.calendar.CalendarStaff at /calendar/staff
Course.calendar.LmsMe at /lms/me
Course.calendar.LmsStaffDashboard at /lms/staff-dashboard
```
