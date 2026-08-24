# Roster

A course manager establishes the one class record with
[Course.roster.ConfigureClass](reaction:Course.roster.ConfigureClass). The
[theClassConfiguration view](view:Course.roster.theClassConfiguration) reads that optional record, which
[Course.roster.ClassConfiguration](reaction:Course.roster.ClassConfiguration) returns to course managers as `null` before configuration.
[Course.roster.UpdateClass](reaction:Course.roster.UpdateClass) requires `course:manage` to revise that
record afterwards and refuses `CLASS_NOT_CONFIGURED` while there is none, so
establishing the class and correcting it stay separate acts rather than one
endpoint that quietly does either.
[Course.roster.SectionsList](reaction:Course.roster.SectionsList) forms
[every section's name and meeting details](former:Course.roster.theSections)
public. [Course.roster.SectionsCreate](reaction:Course.roster.SectionsCreate) requires `course:manage`
to add a section. [Course.roster.SectionsUpdate](reaction:Course.roster.SectionsUpdate) requires the same capability
to change a section's name or meeting details.

[Course.roster.ImportPreview](reaction:Course.roster.ImportPreview) parses newline- and comma-delimited rows without
changing state. It does not support CSV quoting or escaping.
[Course.roster.ImportSeats](reaction:Course.roster.ImportSeats) requires `course:manage` and creates
pending seats, reporting as skipped each row whose address already holds a seat.
Skipped says only that no new seat was created for that address, never that the
request left the address alone: the seat already standing there, when it is still
pending, is one of the seats the same request goes on to sweep, which is what
makes importing an address a second time a repair rather than a duplicate.

Importing, resolving, and inviting are one act rather than records to reconcile
later. Every successful import sweeps each pending seat — not only the rows it
just created — and reads [the account at that seat's address](view:Course.roster.theAccountAt)
to send the seat down exactly one of three paths. Adding one person by hand
reaches the seat through that same import, so the same sweep follows it and the
three paths below describe both routes.

[Course.roster.ImportedSeatClaimsItsAccount](reaction:Course.roster.ImportedSeatClaimsItsAccount) takes each pending seat whose
address answers [a live account](view:Course.roster.theLiveAccountAt) and claims that seat for
it at once, so somebody who already has an account is enrolled rather than sent an
invitation to register a second time — an invitation nobody could accept. It
reaches the active seat through Rostering's `claimSeat` rather than through
`enrol`, and the choice is deliberate: a claim is the transition Assignments
watches, so an immediately enrolled student receives the work already published to
their section, while the same seat reached by enrolling would leave them holding
none.

[Course.roster.ImportedSeatInvitesItsAddress](reaction:Course.roster.ImportedSeatInvitesItsAddress) takes each pending seat whose
address answers no account at all and has not been invited yet, so repeating an
import does not resend mail to people already invited. Each invitation carries the
address the seat stores, and Rostering, Authenticating, and the invitation path
normalize an address the same way — trimmed and lower-cased — so the row that was
imported, the address that was invited, the address a claim carries, and the
address an account holds are one string, and the sides always join. When
that invitation is accepted,
[Course.roster.ClaimedInvitationClaimsItsSeat](reaction:Course.roster.ClaimedInvitationClaimsItsSeat) claims the seat held for the same
address. The claim carries the address itself, so no separate profile-to-seat
matching step is involved, and a seat is never left waiting for a manual link.

A pending seat whose address belongs to an archived account takes neither path.
Inviting it would be pointless, because the address is taken and registering it
again is refused, and claiming it would make an active member of somebody who can
never sign in and then release work to them. The seat stays pending and uninvited
and appears in the pending roster; restoring the account, which Authentication
describes, and importing the address again is the repair.

Each of these consequences is a separate action taken after the import or the
invitation has already committed, so each can fail on its own and nothing retries
automatically. Repeating the import is the retry, because the sweep reads every
pending seat again rather than only the newest rows: an address whose invitation
was accepted long ago resolves to its account and is claimed on the next import
instead of staying pending forever.

Three outcomes of a claim are worth naming. `SEAT_NOT_PENDING`, which the sweep
meets when it races the invitation-driven claim for the same seat, is a no-op: the
seat is already active, which is the state the sweep wanted, and nothing is left to
repair. `SEAT_ALREADY_ACTIVE`, when the resolved account already holds an active
seat under another address, leaves the seat pending, where it appears in the
pending roster; the course manager drops the conflicting seat and imports the
address again, which re-enters the sweep against an account that now holds no
active seat and claims the seat as any other import would — or removes the pending
seat instead. A fault leaves that same pending seat, and importing again is the
same repair. Re-import is the completion for both, for the reason the sweep claims
rather than enrols: only a claim releases the work already published, so a repair
that ended in an enrolment would hand back exactly the student this design exists
to avoid. It is also the shape the archived-account repair already has — restore,
then import again.

[Course.roster.Enrol](reaction:Course.roster.Enrol) is the single-person counterpart to an import:
a course manager enrols somebody who already has an account, without waiting on
one. Completing a pending seat keeps the kind and section that import recorded
and leaves the supplied ones unused. Any other seat for the address — active or dropped — is
refused first as `SEAT_ALREADY_EXISTS`, so somebody who was dropped is reinstated
rather than enrolled again; only when no such seat exists does a claimant who
already holds an active seat get `SEAT_ALREADY_ACTIVE`. A seat completed this way
receives no release fan-out: enrolling is not a transition Assignments watches, as
claiming and reinstating are, so a course manager who enrols somebody who should
already hold published work owns that follow-up, and publishing or revising an
assignment later is what reaches them. Importing the address instead leaves the
releases to the sweep.

[Course.roster.AddPerson](reaction:Course.roster.AddPerson) is how a course manager adds one
person from the staff roster page, on the same tab as the CSV import and without
writing CSV. It requires `course:manage`, [composes the one row](computation:singleImportRow) the
form describes, and creates the seat through the same import action a one-row CSV
would, so a hand-typed person ends holding what an import of that row would leave
them holding: the sweep claims the seat when an
account already holds the address, which releases the work already published to
that section, and invites the address when no account holds it. That is why the
form does not enrol. `Enrol` reaches an active seat without the release fan-out,
which is right for a course manager who deliberately wants the seat alone and
wrong for a form whose promise is that adding one person and importing one row
end the same way.

[The seat standing at an address](view:Course.roster.theSeatAt) decides which of the two
answers a repeated address gets. An address that already carries an active or
dropped seat is refused `SEAT_ALREADY_EXISTS`, the state `Enrol` refuses as well,
because the repair there is reinstating or removing that seat rather than adding
the person again. A still-pending seat is not refused: the hand-add creates no
second seat, refreshes the seat's display name when the form supplies one, and
re-enters the sweep, which is exactly the repair re-importing the row performs.
That seat keeps the kind and section it was created with and leaves the supplied
ones unused, as completing a pending seat through `Enrol` does, so the only thing
a second add changes about a seat already standing is its name. Keeping that door
open is the point — dropping a conflicting seat and adding the address again, or
restoring an archived account and adding it again, are the repairs this page
already depends on, and refusing every address that carries a seat would leave
them reachable only by pasting one line of CSV into the import box beside the
form.

The answer reports what the request can see for itself, never what the sweep will
have done with it. It says whether this call created a seat at that address or
found one already standing there, and what the account at that seat's address
answers while the request is still running — a live account, an archived account,
or no account at all — which is the same reading the sweep takes to choose the
seat's path. A staff surface can therefore say that the person already has an
account and is being enrolled now, or that an invitation is on its way to that
address, and both remain honest: the claim and the invitation are consequences
that run after the seat commits, so neither is decided when this answer is
formed. The active, pending, and dropped rosters are the only durable answer to
what became of the seat, and a surface reads them again rather than trusting this
response; behavioral evidence that a hand-added person becomes active, or becomes
pending and invited, asserts against `/roster/list`, `/roster/pending`, and the
outbox for the same reason. It says nothing about the other seats the same sweep
touched: because the sweep reads every pending seat, adding one person can invite
an address an earlier import left uninvited, and that invitation shows up in the
pending roster and in the outbox rather than being attributed to this call, which
was asked to add one person and answers for that person.

The same form is how a course manager gives themselves a seat. The home page's
affordance opens it holding the caller's own address and display name with a
STAFF kind, and adds nobody by being followed: only submitting the form adds
anyone, so the caller confirms what is about to happen to the roster. Seat kind
still confers nothing, so staff who add themselves change what the course looks
like to them rather than what they may do.

An import row may carry a display name beside the address, kind, and section, and
so may the single-person form; either way the seat keeps it. The seat is where it
belongs: until somebody accepts an invitation there is no account and no profile
to hold a name, and the seat is the only durable row Commons keeps for that
address. Inviting is left alone — it issues a directed offer and has no business
knowing what its recipient is called — and the invitation mail and its link are
unchanged, so the name never travels in a URL; Authentication describes the
credentialed read that hands it to the registration form instead. A row carrying
no name leaves the seat's name empty and behaves exactly as rows behave today. A
row repeated with a different name corrects a still-pending seat's name, and one
carrying no name never clears a name already stored, so a correction is made by
importing or adding the address again. Once a seat has a holder the name is
neither written nor read again: Profiling owns what that person is called from
registration onward, and a name typed by staff must not outlive the one the
person chose for themselves.

The [theSeatOf view](view:Course.roster.theSeatOf) relates an account to its active seat, so
[Course.roster.RosterMe](reaction:Course.roster.RosterMe) can return the caller's seat or `null`.
[Course.roster.RosterList](reaction:Course.roster.RosterList) gives course managers
[the active roster](former:Course.roster.theRoster).
[Course.roster.PendingRoster](reaction:Course.roster.PendingRoster) gives them
[every seat still waiting to be claimed](former:Course.roster.thePendingRoster) — the invited seats
nobody has accepted yet, the seats held for an archived account, and the seats
whose claim was refused — each carrying the display name it was listed under, or
an empty one when it was listed without a name, so the staff surface can show a
person's name where it otherwise shows only an address, while
[Course.roster.DroppedRoster](reaction:Course.roster.DroppedRoster) gives them
[the seats removed from the active roster](former:Course.roster.theDroppedRoster). Callers without
`course:manage` receive `FORBIDDEN`.

[Course.roster.DropSeat](reaction:Course.roster.DropSeat) moves an active seat to dropped under the same
policy, [Course.roster.ReinstateSeat](reaction:Course.roster.ReinstateSeat) restores an eligible dropped seat, and
[Course.roster.MoveSection](reaction:Course.roster.MoveSection) changes a seat's section.

[Course.roster.RemoveSeat](reaction:Course.roster.RemoveSeat) requires the same capability and deletes a seat
outright, in whichever state it is — pending, active, or dropped — and answers
`SEAT_NOT_FOUND` for one that is already gone. Dropping stays the reversible path
for an ordinary departure; removal is the destructive one, so the staff surface
asks for it explicitly rather than offering it as another way to drop somebody.
It deletes the seat and nothing else. The account stays registered and able to
sign in, it keeps whatever role it holds, and every course record keyed to that
account — assignment releases, submissions, grades, late-day grants and uses, and
staff notes — is retained, so a person added again later reads their earlier work.
The endpoint answers which address the removal freed, and the caller is the only
consumer of that answer: once the seat is gone no read can report the address, so
a staff surface confirming what it just removed reads it from the response. That
address identifies no seat afterwards, so a later import or `Enrol` gives it a
fresh seat.

Removal leaves an unclaimed invitation to that address alone; Invitations retracts
one when it should stop working. Removing a pending seat therefore leaves an
invitation that can still be accepted, and the claim it triggers finds no seat
held for the address and does nothing, which leaves an account with no seat — the
state of anybody who has registered but has not been enrolled.

Seats record enrolment only. What a member of staff may do comes from the role
an administrator assigns them, not from the kind recorded on their seat, so
dropping, reinstating, or removing a seat never silently changes anybody's
capabilities.

A seat therefore comes from a course manager either way: importing an address, which
now claims the seat outright when an account already holds that address, or
enrolling somebody directly. Since seat kind confers nothing, staff — and the
initial administrator registered through setup, who has no seat at all — acquire
one exactly as a student does, by being imported or enrolled. Until that happens
they hold their capabilities but hold no seat, so the reads that gate on active
course membership, such as the profile and user-search reads, treat them as outside
the course.

Seat changes commit before assignment follow-ups. If a release fan-out refuses or
faults, the roster transition remains and there is no shared transaction; a later
qualifying transition is needed to trigger the rule again.

```endpoints
Course.roster.AddPerson at /roster/add-person
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
Course.roster.RemoveSeat at /roster/remove
Course.roster.RosterList at /roster/list
Course.roster.RosterMe at /roster/me
Course.roster.SectionsCreate at /roster/sections/create
Course.roster.SectionsList at /roster/sections/list
Course.roster.SectionsUpdate at /roster/sections/update
Course.roster.UpdateClass at /roster/update-class
```
