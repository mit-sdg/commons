# Late days

[Course.lateDays.Policy](reaction:Course.lateDays.Policy) lets late-day managers read the current allowance,
per-assignment limit, and hours per day. [Course.lateDays.ConfigurePolicy](reaction:Course.lateDays.ConfigurePolicy)
replaces those terms, so every learner's next computed balance immediately uses
the new default. [Course.lateDays.Grant](reaction:Course.lateDays.Grant) adds a positive, time-stamped grant
to one learner; grants are retained rather than folded into a stored balance.

An active student uses [Course.lateDays.Apply](reaction:Course.lateDays.Apply) to spend days on an assignment.
[Course.lateDays.Change](reaction:Course.lateDays.Change) replaces the amount of that student's standing use.
[Course.lateDays.Cancel](reaction:Course.lateDays.Cancel) cancels the standing use without removing its history.
[Course.lateDays.List](reaction:Course.lateDays.List) forms the student's
[complete applied and canceled use history](former:Course.lateDays.theLateDayUsesOf).
[Course.lateDays.Balance](reaction:Course.lateDays.Balance) forms the learner's
[current granted, used, and remaining balance](former:Course.lateDays.theLateDayBalanceOf)
for the learner or authorized staff. Requests naming a non-student, and unauthorized
requests for someone else's balance, are hidden as `NOT_FOUND`.

[Course.lateDays.StaffChange](reaction:Course.lateDays.StaffChange) lets late-day managers replace another active
student's standing use. [Course.lateDays.StaffCancel](reaction:Course.lateDays.StaffCancel) lets late-day managers cancel another active
student's standing use. [Course.lateDays.ForAssignment](reaction:Course.lateDays.ForAssignment) gives authorized staff
[the current uses on one assignment](former:Course.lateDays.theLateDayUsesOn); general policy reads instead return `FORBIDDEN` when
capability is missing.

Banking owns balance and per-item limits but treats an assignment as opaque.
Applying or changing days does not check that the assignment exists, is released
to the learner, remains open, or accepts late days. Each request changes only Banking, so a later course-state change leaves that
use in place.

```endpoints
Course.lateDays.Apply at /late-days/apply
Course.lateDays.Balance at /late-days/balance
Course.lateDays.Cancel at /late-days/cancel
Course.lateDays.Change at /late-days/change
Course.lateDays.ConfigurePolicy at /late-days/configure-policy
Course.lateDays.ForAssignment at /late-days/for-assignment
Course.lateDays.Grant at /late-days/grant
Course.lateDays.List at /late-days/list
Course.lateDays.Policy at /late-days/policy
Course.lateDays.StaffCancel at /late-days/staff-cancel
Course.lateDays.StaffChange at /late-days/staff-change
```
