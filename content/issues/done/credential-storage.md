---
milestone: repository-release
concepts:
  - Authenticating
---

# Store password verifiers instead of passwords

## Resolution at completion

Authenticating stores only a salted scrypt verifier. The engine redacts
credential-shaped action input before retaining it or sending it to an
observer, while keeping the raw input only for the lifetime of its causal flow.
The exact verifier format and parameters live in the Authenticating
specification.

`/auth/login` returns 401 with `{"error":"UNAUTHORIZED"}` for an unknown
username or a wrong password. It does not identify which credential failed.

## Decision at completion

Both floors follow the verifier contract in the Authenticating specification.
Registration and password change derive the verifier, authentication checks
it, and the HTTP response does not identify which credential failed.

## Verification at completion

Memory and MongoDB tests inspect stored records, confirm successful authentication
and password change, and confirm that no plaintext password remains. The same
concept tests confirm that unknown usernames and wrong passwords produce the same
`InvalidCredentials` refusal. A public-failure mapping test maps
`INVALID_CREDENTIALS` to 401 `{"error":"UNAUTHORIZED"}`. An instrumented
authentication test finds `[redacted]` in retained action and fault records
and observer events for password fields.
