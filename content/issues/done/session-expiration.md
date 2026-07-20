---
milestone: repository-release
concepts:
  - Sessioning
  - Timing
---

# Expire server-side sessions with their cookies

## Resolution at completion

Sessioning persists an expiry one day after login. The HTTP edge advances
Timing before every session-bearing request, and every identity read rejects a
session at or after that boundary.

Before the boundary, `/auth/me` returns 200 with the account response. At the
boundary, the same cookie returns 401 with `{"error":"UNAUTHORIZED"}` and a
`Set-Cookie` header whose `Max-Age=0` clears it. Replaying the value returns the
same 401 response. Memory and MongoDB apply the same rule, including through a
fresh Mongo Sessioning instance.

## Decision at completion

Sessioning records an expiry exactly one day after login. Every identity read
uses Timing's explicit current moment and rejects a session at or after that
boundary. An expired session is removed when it is presented. Memory and
MongoDB follow the same rule, including after restart.

## Verification at completion

Both concept floors test the instant before expiry and the expiry instant.
HTTP tests confirm the 200 response before expiry, the exact 401 response and
`Max-Age=0` clearing header at expiry, and the 401 replay response. A fresh
Mongo Sessioning instance rejects the persisted session at expiry.
