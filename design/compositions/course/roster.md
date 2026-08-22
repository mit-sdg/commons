# Roster

A roster manager establishes the one class record with
[Course.roster.ConfigureClass](reaction:Course.roster.ConfigureClass). The
[theClassConfiguration view](view:Course.roster.theClassConfiguration) reads that optional record, which
[Course.roster.ClassConfiguration](reaction:Course.roster.ClassConfiguration) returns to roster managers as `null` before configuration.
[Course.roster.SectionsList](reaction:Course.roster.SectionsList) forms
[every section's name and meeting details](former:Course.roster.theSections)
public. [Course.roster.SectionsCreate](reaction:Course.roster.SectionsCreate) requires roster-management capability
to add a section. [Course.roster.SectionsUpdate](reaction:Course.roster.SectionsUpdate) requires the same capability
to change a section's name or meeting details.

[Course.roster.ImportPreview](reaction:Course.roster.ImportPreview) parses newline- and comma-delimited rows without
changing state. It does not support CSV quoting or escaping.
[Course.roster.ImportSeats](reaction:Course.roster.ImportSeats) is staff-only and creates pending seats while
reporting rows skipped because their external key already exists.

A logged-in person uses [Course.roster.ClaimSeat](reaction:Course.roster.ClaimSeat) to claim a pending seat only
when the [identityMatchedSeat view](view:Course.roster.identityMatchedSeat) finds a seat whose imported email
exactly matches their profile email and whose external key they provide. [Course.roster.LinkUser](reaction:Course.roster.LinkUser) lets roster staff link a seat directly
to a supplied user identity without that match or a separate Authenticating
existence check. Either operation can trigger
student assignment-release rules. When the claimed seat is staff,
[Course.roster.StaffSeatGrantsCourseStaff](reaction:Course.roster.StaffSeatGrantsCourseStaff) ensures and grants the built-in
course-staff role unless that account already holds it.

The [theSeatOf view](view:Course.roster.theSeatOf) relates an account to its active seat, so
[Course.roster.RosterMe](reaction:Course.roster.RosterMe) can return the caller's seat or `null`.
[Course.roster.RosterList](reaction:Course.roster.RosterList) gives roster staff
[the active roster](former:Course.roster.theRoster).
[Course.roster.PendingRoster](reaction:Course.roster.PendingRoster) gives roster staff
[the seats awaiting an account link](former:Course.roster.thePendingRoster), while
[Course.roster.DroppedRoster](reaction:Course.roster.DroppedRoster) gives them
[the seats removed from the active roster](former:Course.roster.theDroppedRoster). Callers without roster
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

```endpoints
Course.roster.ClaimSeat at /roster/claim-seat
Course.roster.ClassConfiguration at /roster/class
Course.roster.ConfigureClass at /roster/configure-class
Course.roster.DropSeat at /roster/drop
Course.roster.DroppedRoster at /roster/dropped
Course.roster.ImportPreview at /roster/import-preview
Course.roster.ImportSeats at /roster/import
Course.roster.LinkUser at /roster/link-user
Course.roster.MoveSection at /roster/move-section
Course.roster.PendingRoster at /roster/pending
Course.roster.ReinstateSeat at /roster/reinstate
Course.roster.RosterList at /roster/list
Course.roster.RosterMe at /roster/me
Course.roster.SectionsCreate at /roster/sections/create
Course.roster.SectionsList at /roster/sections/list
Course.roster.SectionsUpdate at /roster/sections/update
```
