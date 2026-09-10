# Session boundary

Private Commons behavior trusts the account resolved from the request's session;
a user identifier supplied in a request never replaces that account.

[Access.session.InvalidSessionIsRejected](reaction:Access.session.InvalidSessionIsRejected) rejects every request whose session
has no live, unarchived user. An expired retained session is ended before the reaction
returns `UNAUTHORIZED`; an unknown key returns the same error without an end
request. Session cleanup is a separate action, so a cleanup fault can replace
the explicit response with `INTERNAL_ERROR`, but it cannot make the session
valid or admit the protected operation.

The [activeUser view](view:Access.session.activeUser) reads the current time and Sessioning state whenever a
request runs, relating only a live session to an unarchived account. The archive check
blocks retained sessions even if account archiving succeeded but session cleanup
failed; restoring an account does not itself revoke those retained sessions. It does not copy
account identity into another access model.

The HTTP gate also checks account archiving: it protects routes without a
session input whose composition therefore does not use the activeUser view.
An archived account cannot use those routes to keep a retained session alive.

The HTTP edge refreshes Sessioning after successful protected requests, excluding
cookie-clearing routes. Concept queries and direct application invocations do not refresh.
Renewal uses the server clock when its action runs: an expired or revoked session
cannot be revived, including when a request finishes after its idle deadline.
A failed renewal leaves the completed response intact and emits a redacted error;
the MongoDB renewal operation has a one-second timeout. Renewal is awaited, not
queued as detached work.

New sessions expire after 72 hours without successful HTTP use and always end at
their four-calendar-month cap. Months are measured in UTC, preserving time of day
and clamping to the last day of the target month. Polling counts as activity.
The login cookie expires at that fixed cap; renewal changes only the server's
idle deadline. A retained cookie for an idle-expired session is rejected normally.
Legacy sessions without a cap keep their fixed expiry until the next login.
