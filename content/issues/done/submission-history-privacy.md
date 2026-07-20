---
milestone: repository-release
concepts:
  - Submitting
  - Rostering
---

# Authorize submission history reads

## Resolution at completion

`/submissions/for-student`, `/submissions/latest`, and
`/submissions/attempts` require a session. An active learner may read their own
records. A caller with `submissions:view-all` may read an active learner's
records. The successful bodies are `{"submissions":[...]}` for the history,
`{"submission":<record-or-null>}` for the latest attempt, and
`{"attempts":[...]}` for attempts.

Another learner and staff without `submissions:view-all` receive 404 with
`{"error":"NOT_FOUND"}` for either an existing or unknown submitter. A capable
staff caller also receives that response for an unknown or inactive submitter.
An anonymous caller receives 401 with `{"error":"UNAUTHORIZED"}`.

## Decision at completion

An active learner may read their own submission records. A caller with
`submissions:view-all` may read an active learner's records. Other callers do
not learn whether the submitter exists.

## Verification at completion

HTTP tests cover all three endpoints for the owner, another learner, a caller
with `submissions:view-all`, staff without it, an unknown learner, and an
anonymous caller. They confirm the exact success, 401, and 404 responses above.
