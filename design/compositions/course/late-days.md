# Late days

[Course.lateDays.Policy](reaction:Course.lateDays.Policy) lets callers holding `student-records` read the current allowance,
per-assignment limit, and hours per day. [Course.lateDays.ConfigurePolicy](reaction:Course.lateDays.ConfigurePolicy)
replaces those terms, so every learner's next computed balance immediately uses
the new default. [Course.lateDays.Grant](reaction:Course.lateDays.Grant) adds a positive, time-stamped grant
to one learner; grants are retained rather than folded into a stored balance.

An active student uses [Course.lateDays.Apply](reaction:Course.lateDays.Apply) to spend days on an assignment.
[Course.lateDays.Change](reaction:Course.lateDays.Change) replaces the amount of that student's standing use.
[Course.lateDays.Cancel](reaction:Course.lateDays.Cancel) cancels the standing use without removing its history.
[Course.lateDays.List](reaction:Course.lateDays.List) forms the student's
[complete applied and canceled use history](former:Course.lateDays.theLateDayUsesOf) beside the policy's hours per day, which the client uses to calculate effective due and close dates.
[Course.lateDays.Balance](reaction:Course.lateDays.Balance) forms the learner's
[current granted, used, and remaining balance](former:Course.lateDays.theLateDayBalanceOf)
for the learner or a caller holding `student-records`. Requests naming a non-student, and unauthorized
requests for someone else's balance, are hidden as `NOT_FOUND`.

[Course.lateDays.StaffChange](reaction:Course.lateDays.StaffChange) lets callers holding `student-records` replace another active
student's standing use. [Course.lateDays.StaffCancel](reaction:Course.lateDays.StaffCancel) lets the same callers cancel another active
student's standing use. [Course.lateDays.ForAssignment](reaction:Course.lateDays.ForAssignment) gives them
[the current uses on one assignment](former:Course.lateDays.theLateDayUsesOn). Every staff path here enforces the one
`student-records` capability; general policy reads return `FORBIDDEN` when it is
missing.

Banking owns balance and per-item limits but treats an assignment as opaque. The application permits applying or changing days only for a published assignment released to the learner. Effective due and close dates add the standing use's days times the policy unit, and the learner submission gate uses the effective close. A later archive prevents further changes but leaves use history in place.

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
