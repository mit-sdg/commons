# Authentication

Authentication creates the account and session that every private operation
trusts.

With an unclaimed email invitation and its temporary credential,
[Access.auth.AcceptInvitation](reaction:Access.auth.AcceptInvitation) verifies the invitation, creates the account
and profile, and finally claims the invitation. The account carries the invited
address, and the profile carries none: Authenticating owns a person's email and
holds it for one account alone, so accepting an invitation to an address that
some account already holds is refused with `EMAIL_TAKEN` rather than creating a
second account on it. That refusal leaves the invitation unclaimed and is the
loud end of an invitation that should never have been issued; the person signs in
with the account they already have, and an administrator retracts the invitation
through Invitations. These are ordered actions, not
one transaction: if profile creation or claiming fails after registration, the
new account remains and Commons does not roll it back.

An invited person reaches that form before they have an account, so the form asks
Commons what the invitation already knows.
[Access.auth.InvitationDetails](reaction:Access.auth.InvitationDetails) takes an invitation and its
temporary credential and answers one invitation record holding
[the address it was issued to and the name held for that address](former:Access.auth.theInvitationDetails),
so the form arrives holding a display name its reader may edit before registering,
the way it already arrives bound to the invited address. The frontend also
suggests the part of that address before `@` as the username and leaves it
editable. It discloses nothing a holder of that invitation and credential does
not already hold: the credential is
the secret the mail carried to that one address, and the name is the one a course
manager typed for that same address. An invitation that is unknown, already
claimed, or presented with the wrong credential is refused `INVITATION_INVALID`,
saying only that the invitation is not valid, and the three cases are deliberately
indistinguishable, exactly as they are when it is accepted.

The name comes from the pending seat the roster holds for the address, which is
where Roster explains it belongs. A seat carrying no name, and no seat at all —
because none was ever imported, or because the seat was removed while the
invitation stayed live — answer alike as an empty name, so a holder learns nothing
about the roster from the difference and registration continues either way.
Accepting is unchanged: the display name the person submits is the one their
profile is created with, prefilled or typed. Because a person who has no account
cannot hold a session, this read answers without one, and `src/edge.ts` lists its
path among those its session gate lets through, beside the acceptance it precedes.

[Access.auth.Login](reaction:Access.auth.Login) verifies a username and password, captures the current
time, and starts a timed session. An archived account cannot sign in: the
[theArchivedUserNamed view](view:Access.auth.theArchivedUserNamed) relates an exact username to an
account that has been archived, and login still verifies the password before
answering `FORBIDDEN`, so a wrong password stays indistinguishable from an
unknown account. [Access.auth.Logout](reaction:Access.auth.Logout) resolves the caller
from a live session before ending that session. [Access.auth.Me](reaction:Access.auth.Me) uses the same
resolved caller to return account and profile data, so a body parameter cannot
select another account; the email it reports comes from the caller's account,
which is where Commons keeps an address, and never from the profile. For a public exact-username lookup, the
[theUserNamed view](view:Access.auth.theUserNamed) relates an exact username to its account.
[Access.auth.Resolve](reaction:Access.auth.Resolve) returns that identity or `null` without exposing
credentials or profile fields.

[Access.auth.ChangePassword](reaction:Access.auth.ChangePassword) first verifies the current password and changes
the verifier, then ends every session for that account, including the calling
session. The person must log in again; a failure after the password change does
not restore the old password.

After any successful account registration,
[Access.auth.BootstrapAdminOnRegister](reaction:Access.auth.BootstrapAdminOnRegister) checks whether this is the sole account
and whether nobody yet holds `administer`; only when both conditions hold does it
ensure and grant the built-in administrator role. [Access.auth.BootstrapAdminOnLogin](reaction:Access.auth.BootstrapAdminOnLogin)
performs the same repair when the sole account logs in, so an installation that
missed registration-time setup can recover. A failed role grant does not undo
the account registration or login that triggered it.

[Access.auth.RegisterInitialAdmin](reaction:Access.auth.RegisterInitialAdmin) accepts the one-time setup secret and first
account details only while no account exists. An application computation checks
the candidate against deployment configuration; Authentication never owns or
stores it. A wrong or disabled secret returns `UNAUTHORIZED`, and an initialized
installation returns `CONFLICT`. Successful
registration creates the profile and triggers the same administrator-bootstrap
reaction described above. The built-in administrator role carries the
`administer` wildcard alone, which every enforcing endpoint accepts in place of
the capability it requires, so an administrator never has to be repaired later to
keep up with capabilities added after their role was created. These owner actions
are not one transaction, so a later failure does not remove the account.

[Access.auth.Permissions](reaction:Access.auth.Permissions) answers everything the signed-in caller may
do, in one read. Every capability Commons declares is held and enforced in the
single reserved `commons` context, so this read needs no context of its own: it
takes the role the caller holds there and answers the whole registry when that
role carries `administer`, and the role's own capability names otherwise, so the
browser and the endpoints that enforce policy cannot disagree about what a caller
can reach. A caller holding no role receives an empty list. That expansion is
presentation for the browser alone: an enforcing endpoint never reads an expanded
list, but checks the capability it requires or `administer` against the role as
Roling stores it.

Only administrators may archive an account.
[Access.auth.ArchiveUser](reaction:Access.auth.ArchiveUser) resolves the caller from the session and
verifies that the caller holds `administer` and is not the account named. An
archived account can never sign in again, so it must not go on counting as a
holder of `administer`: archiving refuses `LAST_ADMINISTRATOR` when the named
account is the only holder of `administer` in the `commons` context, which keeps the
deployment from losing every usable administrator one archive at a time. That
refusal is a floor rather than an outcome a caller can provoke: while the caller
holds `administer` themselves and cannot name their own account, the named account
is never the only holder, so the branch is not reached. Otherwise
it revokes the role that account holds, if it holds one, then archives the
account, then ends every session it holds. The account and everything it authored
are kept; it simply can no longer sign in. An administrator cannot archive their
own account, and a non-administrator receives `FORBIDDEN`.

Those are ordered actions, not one transaction, and they are visible between
steps. Between the revocation and the archive the account holds no role while it
can still sign in, so for that interval it reads as an ordinary member; if
archiving then faults, that is where it stays, and the administrator archives it
again or assigns a role back through Roles. If ending sessions faults, the account
stays archived while its existing sessions live until they expire.
[Access.auth.RestoreUser](reaction:Access.auth.RestoreUser) lifts the archive and lets that person sign
in again; it does not give back the role the account held, because revoking it was
a separate act, so an administrator assigns one again when the person needs it.
Archiving keeps the account registered, so it keeps that account's email address
too: no second account can register the address an archived account holds, and
restoring is the way it becomes usable again. Commons decides that here rather
than in Authenticating, which knows nothing of archiving and only ever sees one
account per address. Holding the address is the point — archiving is reversible,
and releasing an address would let somebody else take an identity the archived
account can reclaim.
Because archiving revokes, every account holding `administer` is an account that
can still sign in, which is what makes the last-administrator guard on assignment
and revocation worth checking.

Only administrators may list all registered user accounts.
[Access.auth.ListUsers](reaction:Access.auth.ListUsers) resolves the caller from the
session, verifies that the caller holds `administer`, and gives administrators
[the registered users](former:Access.auth.theRegisteredUsers). A non-administrator receives `FORBIDDEN`.

```endpoints
Access.auth.AcceptInvitation at /auth/accept-invitation
Access.auth.ArchiveUser at /users/archive
Access.auth.ChangePassword at /auth/changePassword
Access.auth.InvitationDetails at /auth/invitation
Access.auth.ListUsers at /users/list
Access.auth.Login at /auth/login
Access.auth.Permissions at /auth/permissions
Access.auth.Logout at /auth/logout
Access.auth.Me at /auth/me
Access.auth.RegisterInitialAdmin at /setup/register-admin
Access.auth.Resolve at /auth/resolve
Access.auth.RestoreUser at /users/restore
```
