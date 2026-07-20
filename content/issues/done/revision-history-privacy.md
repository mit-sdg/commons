---
milestone: repository-release
concepts:
  - Posting
  - Revising
  - Trashing
---

# Apply post access policy to revision history

## Resolution at completion

For a live post, `/revisions/list`, `/revisions/get`, and `/revisions/latest`
remain public and return `{"revisions":[...]}` or
`{"revision":[...]}`. A trashed, purged, or unknown item receives
404 with `{"error":"NOT_FOUND"}` on all three routes.

The corresponding `/moderation/revisions/*` routes require a session and the
`moderate` capability. They return a trashed post's revision data to a
moderator. A non-moderator, live post, purged item, or unknown item receives
404 with `{"error":"NOT_FOUND"}`. An anonymous caller receives 401 with
`{"error":"UNAUTHORIZED"}`.

## Decision at completion

Live revision history is public. Trashed history is available only through the
moderation routes to a caller with `moderate`. Purged and unknown history is
unavailable.

## Verification at completion

HTTP tests cover all six routes for a live post, its author, a trashed post, a
moderator, a non-moderator, a purged post, an unknown identifier, and an
anonymous caller. They confirm the exact success, 401, and 404 responses above.
