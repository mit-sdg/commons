---
milestone: repository-release
concepts:
  - Profiling
  - Rostering
---

# Keep profile email private

## Resolution at completion

`/auth/me` returns the signed-in account owner's email. `/profiles/get` returns
email to the named owner only when that owner is an active course member, and
to another reader only when the reader has `roster:manage`. An active member
without that capability receives `displayName`, `bio`, and `avatar`, with no
`email`. User search also omits email.

An anonymous request receives 401 with `{"error":"UNAUTHORIZED"}`. An
unrostered signed-in reader receives 404 with `{"error":"NOT_FOUND"}`. A
request for an unknown profile also receives that 404 response.

## Decision at completion

Signed-in course members may read display names, bios, and avatars. The account
owner and a reader with `roster:manage` may also read email. Other capabilities
do not grant email access.

## Verification at completion

Tests cover `/auth/me`, `/profiles/get`, and user search for an anonymous
caller, an unrostered signed-in user, an active learner, the account owner, a
reader with `roster:manage`, a staff reader without it, and an unknown user.
They confirm the exact success shapes and the 401 and 404 responses above.
