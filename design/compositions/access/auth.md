# Authentication

Authentication creates the account and session that every private operation
trusts.

With an unclaimed email invitation and its temporary credential,
[Access.auth.AcceptInvitation](reaction:Access.auth.AcceptInvitation) verifies the invitation, creates the account
and profile, and finally claims the invitation. These are ordered actions, not
one transaction: if profile creation or claiming fails after registration, the
new account remains and Commons does not roll it back.

[Access.auth.Login](reaction:Access.auth.Login) verifies a username and password, captures the current
time, and starts a timed session. [Access.auth.Logout](reaction:Access.auth.Logout) resolves the caller
from a live session before ending that session. [Access.auth.Me](reaction:Access.auth.Me) uses the same
resolved caller to return account and profile data, so a body parameter cannot
select another account. For a public exact-username lookup, the
[theUserNamed view](view:Access.auth.theUserNamed) relates an exact username to its account.
[Access.auth.Resolve](reaction:Access.auth.Resolve) returns that identity or `null` without exposing
credentials or profile fields.

[Access.auth.ChangePassword](reaction:Access.auth.ChangePassword) first verifies the current password and changes
the verifier, then ends every session for that account, including the calling
session. The person must log in again; a failure after the password change does
not restore the old password.

After any successful account registration,
[Access.auth.BootstrapAdminOnRegister](reaction:Access.auth.BootstrapAdminOnRegister) checks whether this is the sole account
and whether anyone holds `administer`; if both conditions hold, it ensures and
grants the built-in administrator role. [Access.auth.BootstrapAdminOnLogin](reaction:Access.auth.BootstrapAdminOnLogin)
performs the same repair when the sole account logs in, so an installation that
missed registration-time setup can recover. A failed role grant does not undo
the account registration or login that triggered it.

[Access.auth.RegisterInitialAdmin](reaction:Access.auth.RegisterInitialAdmin) accepts the one-time setup secret and first
account details only while no account exists. An application computation checks
the candidate against deployment configuration; Authentication never owns or
stores it. A wrong or disabled secret returns `UNAUTHORIZED`, and an initialized
installation returns `CONFLICT`. Successful
registration creates the profile and triggers the same administrator-bootstrap
reaction described above. The built-in administrator role includes
`roster:manage`, the minimum course capability needed to configure and import the
initial roster through supported operations; it does not include the remaining
course-staff capabilities. For installations created with an older administrator
bundle, [Access.auth.RepairInitialAdminRosterBootstrapOnLogin](reaction:Access.auth.RepairInitialAdminRosterBootstrapOnLogin)
repairs the sole administrator on login by granting a dedicated role containing
only `roster:manage`; it does not broaden later multi-account administrators.
These owner actions are not one transaction, so a later failure does not remove
the account.

Only administrators may list all registered user accounts.
[Access.auth.ListUsers](reaction:Access.auth.ListUsers) resolves the caller from the
session, verifies that the caller holds `administer`, and gives administrators
[the registered users](former:Access.auth.theRegisteredUsers). A non-administrator receives `FORBIDDEN`.

```endpoints
Access.auth.AcceptInvitation at /auth/accept-invitation
Access.auth.ChangePassword at /auth/changePassword
Access.auth.ListUsers at /users/list
Access.auth.Login at /auth/login
Access.auth.Logout at /auth/logout
Access.auth.Me at /auth/me
Access.auth.RegisterInitialAdmin at /setup/register-admin
Access.auth.Resolve at /auth/resolve
```
