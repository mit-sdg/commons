# Access

Access composition establishes a caller from authentication and session state,
then applies shared authorization policy to forum and course operations. Request
identities never substitute for the user established by the active session.

## Compositions

### Authentication and sessions

Authenticating creates accounts and verifies credentials; Sessioning represents
logged-in use. Timing supplies the instant used to create, expire, and invalidate
sessions. Password changes invalidate the caller's sessions.

### Invitations

Registration consumes an email invitation before creating the account and
profile. Inviting owns the durable credential, while composition normalizes the
recipient, renders the Commons message, and gives Mailing a complete envelope.
Resending preserves the invitation credential.

### Roles and roster authority

Roling grants contextual capabilities. Rostering contributes course membership
and staff status; composition translates those facts into the capabilities used
by course and forum policy rather than copying them into either concept.

## Views

Access views derive the active user and paired allow/deny decisions from
Sessioning, Roling, Rostering, and the relevant resource state. The same views
are reused wherever a permission has the same application meaning.
