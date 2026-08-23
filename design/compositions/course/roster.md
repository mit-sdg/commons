# Roster

A course manager establishes the one class record with
[Course.roster.ConfigureClass](reaction:Course.roster.ConfigureClass). The
[theClassConfiguration view](view:Course.roster.theClassConfiguration) reads that optional record, which
[Course.roster.ClassConfiguration](reaction:Course.roster.ClassConfiguration) returns to course managers as `null` before configuration.
[Course.roster.SectionsList](reaction:Course.roster.SectionsList) forms
[every section's name and meeting details](former:Course.roster.theSections)
public. [Course.roster.SectionsCreate](reaction:Course.roster.SectionsCreate) requires `course:manage`
to add a section. [Course.roster.SectionsUpdate](reaction:Course.roster.SectionsUpdate) requires the same capability
to change a section's name or meeting details.

[Course.roster.ImportPreview](reaction:Course.roster.ImportPreview) parses newline- and comma-delimited rows without
changing state. It does not support CSV quoting or escaping.
[Course.roster.ImportSeats](reaction:Course.roster.ImportSeats) requires `course:manage` and creates
pending seats, reporting rows skipped because their address already holds a seat.

Importing and inviting are one act rather than two records to reconcile later.
[Course.roster.ImportedSeatInvitesItsAddress](reaction:Course.roster.ImportedSeatInvitesItsAddress) invites every pending seat whose
address has not been invited yet, so repeating an import does not resend mail to
people already invited. Each invitation carries the address the seat stores, and
Rostering and the invitation path normalize an address the same way — trimmed and
lower-cased — so the row that was imported, the address that was invited, and the
address a claim carries are the same string, and the two sides always join. When
that invitation is accepted,
[Course.roster.ClaimedInvitationClaimsItsSeat](reaction:Course.roster.ClaimedInvitationClaimsItsSeat) claims the seat held for the same
address. The claim carries the address itself, so no separate profile-to-seat
matching step is involved, and a seat is never left waiting for a manual link.

The fan-out invites only a pending seat that has not been invited yet, so
importing an address whose invitation was already accepted sends nothing, and no
later event fires a claim for it: that seat stays pending indefinitely. Completing
it with [Course.roster.Enrol](reaction:Course.roster.Enrol) is the course manager's repair, and because
the address already holds a pending seat, enrolling fills that seat rather than
adding a second one.

Claiming the seat is a separate action taken after the invitation is already
claimed, so it can fail on its own. If it faults, or if Rostering refuses it
because the claimant already holds an active seat, the account and the claimed
invitation remain while the seat stays pending, and the person reads as unenrolled
until somebody acts; nothing retries automatically. `Enrol`, keyed by the same
address, is the retry. When the obstacle is an active seat under another address,
an administrator drops that seat before enrolling the person on the imported
address; otherwise the imported seat simply stays pending, since Commons has no
operation that removes a pending seat.

`Enrol` is also the single-person counterpart to an import: a course manager
enrols somebody who already has an account, without waiting on one. Completing a
pending seat keeps the kind and section that import recorded and leaves the
supplied ones unused. Any other seat for the address — active or dropped — is
refused first as `SEAT_ALREADY_EXISTS`, so somebody who was dropped is reinstated
rather than enrolled again; only when no such seat exists does a claimant who
already holds an active seat get `SEAT_ALREADY_ACTIVE`.

The [theSeatOf view](view:Course.roster.theSeatOf) relates an account to its active seat, so
[Course.roster.RosterMe](reaction:Course.roster.RosterMe) can return the caller's seat or `null`.
[Course.roster.RosterList](reaction:Course.roster.RosterList) gives course managers
[the active roster](former:Course.roster.theRoster).
[Course.roster.PendingRoster](reaction:Course.roster.PendingRoster) gives them
[the seats whose invitations are still unaccepted](former:Course.roster.thePendingRoster), while
[Course.roster.DroppedRoster](reaction:Course.roster.DroppedRoster) gives them
[the seats removed from the active roster](former:Course.roster.theDroppedRoster). Callers without
`course:manage` receive `FORBIDDEN`.

[Course.roster.DropSeat](reaction:Course.roster.DropSeat) moves an active seat to dropped under the same
policy, [Course.roster.ReinstateSeat](reaction:Course.roster.ReinstateSeat) restores an eligible dropped seat, and
[Course.roster.MoveSection](reaction:Course.roster.MoveSection) changes a seat's section.

Seats record enrolment only. What a member of staff may do comes from the role
an administrator assigns them, not from the kind recorded on their seat, so
dropping or reinstating a seat never silently changes anybody's capabilities.

That leaves enrolment as the only source of a seat. Since seat kind confers
nothing and no step links an existing account to a seat by itself, `Enrol` by a
course manager is the way staff — and the initial administrator registered through
setup, who has no seat at all — acquire one. Until somebody enrols them they hold
their capabilities but hold no seat, so the reads that gate on active course
membership, such as the profile and user-search reads, treat them as outside the
course.

Seat changes commit before assignment follow-ups. If a release fan-out refuses or
faults, the roster transition remains and there is no shared transaction; a later
qualifying transition is needed to trigger the rule again.

```endpoints
Course.roster.ClassConfiguration at /roster/class
Course.roster.ConfigureClass at /roster/configure-class
Course.roster.DropSeat at /roster/drop
Course.roster.DroppedRoster at /roster/dropped
Course.roster.Enrol at /roster/enroll
Course.roster.ImportPreview at /roster/import-preview
Course.roster.ImportSeats at /roster/import
Course.roster.MoveSection at /roster/move-section
Course.roster.PendingRoster at /roster/pending
Course.roster.ReinstateSeat at /roster/reinstate
Course.roster.RosterList at /roster/list
Course.roster.RosterMe at /roster/me
Course.roster.SectionsCreate at /roster/sections/create
Course.roster.SectionsList at /roster/sections/list
Course.roster.SectionsUpdate at /roster/sections/update
```
