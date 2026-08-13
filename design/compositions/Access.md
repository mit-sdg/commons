# Access

Access composition turns authentication, sessions, roles, and roster membership
into one caller identity and a set of permission decisions. Endpoints never trust
a user identity supplied by the caller when a session can establish it.

## Compositions

### Authentication

Registration requires a durable, non-expiring invitation and its temporary
password. The current access policy accepts invitations delivered by email.
Login creates a session. Logout and password changes invalidate the applicable
session state.

### Invitations

An administrator may issue or resend an invitation through an email-specific
composition. That composition normalizes the email recipient, asks generic
Inviting to issue an invitation on the `email` channel. A reaction renders the
Commons-specific message and queues the completed envelope in Mailing. Resending
preserves the credential. Invitation administration requires
the same administrator capability as other access controls.

### Roles

Role and capability operations connect authenticated users to the permissions
used by forum and course behavior.

## Views

Permission views answer whether the active user may perform an operation. Denied
and permitted cases remain explicit so each endpoint settles deliberately.
