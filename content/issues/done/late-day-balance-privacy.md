---
milestone: repository-release
concepts:
  - Banking
  - Rostering
---

# Restrict who can read late-day balances

## Resolution at completion

`/late-days/balance` returns
`{"balance":{"granted":<number>,"used":<number>,"remaining":<number>}}` to
the active learner named by the session and to a caller with
`late-days:manage`. Another learner or staff caller without that capability
receives 404 with `{"error":"NOT_FOUND"}`. An unknown or inactive learner also
receives that 404 response. An anonymous caller receives 401 with
`{"error":"UNAUTHORIZED"}`.

## Decision at completion

Only the active learner and a caller with `late-days:manage` may read the
learner's balance.

## Verification at completion

HTTP tests cover the active learner, another learner, a manager, staff without
`late-days:manage`, an inactive or unknown learner, and an anonymous caller.
They confirm the exact success, 401, and 404 responses above.
