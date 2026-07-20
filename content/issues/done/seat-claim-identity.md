---
milestone: repository-release
concepts:
  - Profiling
  - Rostering
  - Roling
---

# Match self-service seat claims to the account email

## Resolution at completion

`/roster/claim-seat` finds a pending seat only when its imported email matches
the signed-in account's profile email. A missing key and an email mismatch both
return 404 with `{"error":"NOT_FOUND"}`. A successful staff-seat claim grants
the course-staff role only after that match succeeds.

`/roster/link-user` remains the roster-management path for linking a different
account to a pending seat.

## Decision at completion

Self-service claim uses the account email as its identity proof without
returning the compared email or adding a claim token. Commons does not reveal
whether a mismatched external key names a pending seat.

## Verification at completion

Memory and MongoDB application tests confirm that a mismatched account receives
the same response for a known learner key, a known staff key, and an unknown
key; gains no seat or staff capability; and leaves one response with no
compared email in retained claim records. Matching learner and staff accounts
can claim their seats, and a roster manager can still link another account.
