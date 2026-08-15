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
select another account. For a public exact-username lookup,
[Access.auth.Resolve](reaction:Access.auth.Resolve) returns the account identity or `null` without exposing
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
reaction described above; these owner actions are not one transaction, so a
later failure does not remove the account.

## Supporting declarations

Views [theUserNamed](view:Access.auth.theUserNamed) support the behavior and result shapes described above.
