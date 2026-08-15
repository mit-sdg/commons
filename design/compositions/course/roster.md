# Roster

A roster manager establishes the one class record with
[Course.roster.ConfigureClass](reaction:Course.roster.ConfigureClass). [Course.roster.ClassConfiguration](reaction:Course.roster.ClassConfiguration) returns
that record to roster managers, or `null` before configuration.
[Course.roster.SectionsList](reaction:Course.roster.SectionsList) makes every section's name and meeting details
public. [Course.roster.SectionsCreate](reaction:Course.roster.SectionsCreate) requires roster-management capability
to add a section. [Course.roster.SectionsUpdate](reaction:Course.roster.SectionsUpdate) requires the same capability
to change a section's name or meeting details.

[Course.roster.ImportPreview](reaction:Course.roster.ImportPreview) parses newline- and comma-delimited rows without
changing state. It does not support CSV quoting or escaping.
[Course.roster.ImportSeats](reaction:Course.roster.ImportSeats) is staff-only and creates pending seats while
reporting rows skipped because their external key already exists.

A logged-in person uses [Course.roster.ClaimSeat](reaction:Course.roster.ClaimSeat) to claim a pending seat only
when their profile email exactly matches the imported email and they provide its
external key. [Course.roster.LinkUser](reaction:Course.roster.LinkUser) lets roster staff link a seat directly
to a supplied user identity without that match or a separate Authenticating
existence check. Either operation can trigger
student assignment-release rules. When the claimed seat is staff,
[Course.roster.StaffSeatGrantsCourseStaff](reaction:Course.roster.StaffSeatGrantsCourseStaff) ensures and grants the built-in
course-staff role unless that account already holds it.

[Course.roster.RosterMe](reaction:Course.roster.RosterMe) lets any logged-in account inspect its own seat or
receive `null`. [Course.roster.RosterList](reaction:Course.roster.RosterList) gives roster staff every active member linked to an
account.
[Course.roster.PendingRoster](reaction:Course.roster.PendingRoster) gives roster staff the seats awaiting an account
link. [Course.roster.DroppedRoster](reaction:Course.roster.DroppedRoster) gives roster staff the seats removed from
the active roster. Callers without roster
capability receive `FORBIDDEN`.

[Course.roster.DropSeat](reaction:Course.roster.DropSeat) requires the session account to hold
`roster:manage` and moves an active seat to dropped. A dropped staff seat then
triggers [Course.roster.DroppedStaffSeatRevokesCourseStaff](reaction:Course.roster.DroppedStaffSeatRevokesCourseStaff), which removes only
the built-in course-staff grant. [Course.roster.ReinstateSeat](reaction:Course.roster.ReinstateSeat) restores an eligible dropped seat under roster
policy. [Course.roster.MoveSection](reaction:Course.roster.MoveSection) uses the same policy to change a seat's
section. Reinstating a staff seat does not
currently re-grant course-staff.

Seat changes commit before role and assignment follow-ups. If a grant,
revocation, or release fan-out refuses or faults, the roster transition remains
and there is no shared transaction; a later qualifying transition is needed to
trigger the rule again.

## Supporting declarations

Views [identityMatchedSeat](view:Course.roster.identityMatchedSeat), [theClassConfiguration](view:Course.roster.theClassConfiguration), [theSeatOf](view:Course.roster.theSeatOf) support the behavior and result shapes described above.

Formers [theDroppedRoster](former:Course.roster.theDroppedRoster), [thePendingRoster](former:Course.roster.thePendingRoster), [theRoster](former:Course.roster.theRoster), [theSections](former:Course.roster.theSections) support the behavior and result shapes described above.
