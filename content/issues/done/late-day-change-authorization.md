---
milestone: repository-release
concepts:
  - Banking
  - Rostering
---

# Restrict who can change late-day uses

## Resolution at completion

An active learner changes or cancels their own use through `/late-days/change`
and `/late-days/cancel`; success returns `{"use":<id>}`. Those endpoints derive
the learner from the session and do not accept another learner's identity. An
inactive learner receives 403 with `{"error":"FORBIDDEN"}`, and an anonymous
caller receives 401 with `{"error":"UNAUTHORIZED"}`.

`/late-days/staff-change` and `/late-days/staff-cancel` accept a named learner
only for a caller with `late-days:manage`. A caller without that capability, an
unknown learner, and an inactive learner receive 404 with
`{"error":"NOT_FOUND"}`.

## Decision at completion

An active learner may change or cancel their own use. Staff corrections use
separate endpoints governed by `late-days:manage`.

## Verification at completion

HTTP tests cover both learner endpoints and both staff endpoints for an active
learner, an inactive learner, an anonymous caller, a manager, a staff caller
without `late-days:manage`, and an unknown learner. They confirm the exact
success, 401, 403, and 404 responses above.
