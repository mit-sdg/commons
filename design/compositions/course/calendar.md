# Calendar and dashboards

[Course.calendar.CalendarMe](reaction:Course.calendar.CalendarMe) gives an active student the published assignments
whose availability or due date falls inside the requested inclusive window.
[Course.calendar.CalendarStaff](reaction:Course.calendar.CalendarStaff) returns the same calendar to a caller with
staff-calendar or roster-management capability. Neither result is filtered by a
student's releases or section.

[Course.calendar.LmsMe](reaction:Course.calendar.LmsMe) returns the calling student's current roster seat.
[Course.calendar.LmsStaffDashboard](reaction:Course.calendar.LmsStaffDashboard) instead requires roster-management
capability and returns every active member plus counts of all assignments,
active grade items, and applied late-day uses belonging to active students.

These are read-time joins over Rostering, Assigning, Itemizing, and Banking.
Publishing or archiving work, changing seats or grade items, and canceling late
days changes the next result without copied dashboard state.

## Supporting declarations

Formers [theCalendarBetween](former:Course.calendar.theCalendarBetween), [theDashboardSeatOf](former:Course.calendar.theDashboardSeatOf), [theStaffDashboard](former:Course.calendar.theStaffDashboard), [theStaffDashboardCounts](former:Course.calendar.theStaffDashboardCounts) support the behavior and result shapes described above.
