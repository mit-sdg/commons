# Access

Access composition turns authentication, sessions, roles, and roster membership
into one caller identity and a set of permission decisions. Endpoints never trust
a user identity supplied by the caller when a session can establish it.

## Compositions

### Authentication

Registration and login create authenticated identities and sessions. Logout and
password changes invalidate the applicable session state.

### Roles

Role and capability operations connect authenticated users to the permissions
used by forum and course behavior.

## Views

Permission views answer whether the active user may perform an operation. Denied
and permitted cases remain explicit so each endpoint settles deliberately.
