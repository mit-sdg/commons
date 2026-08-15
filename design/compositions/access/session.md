# Session boundary

Private Commons behavior trusts the account resolved from the request's session;
a user identifier supplied in a request never replaces that account.

[Access.session.InvalidSessionIsRejected](reaction:Access.session.InvalidSessionIsRejected) rejects every request whose session
has no live user. An expired retained session is ended before the reaction
returns `UNAUTHORIZED`; an unknown key returns the same error without an end
request. Session cleanup is a separate action, so a cleanup fault can replace
the explicit response with `INTERNAL_ERROR`, but it cannot make the session
valid or admit the protected operation.

The [activeUser view](view:Access.session.activeUser) reads the current time and Sessioning state whenever a
request runs, relating only a live session to its account. It does not copy
account identity into another access model.
