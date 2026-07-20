---
milestone: repository-release
concepts:
  - Noting
  - Posting
  - Trashing
---

# Hide the existence of protected resources

## Resolution at completion

An ordinary learner receives 404 with `{"error":"NOT_FOUND"}` when an action
names either a staff-only note or an unknown note. A caller with
`student-notes:manage` can read the staff-only note.

Public post, revision, and satellite reads return 404 with
`{"error":"NOT_FOUND"}` for a trashed, purged, or unknown post. Collection
routes omit those posts. `/threads/forItem` returns 200 with
`{"conversation":null}` for either a purged or unknown post. Satellite
mutations return the same 404 response for hidden targets.

The `/moderation/posts/*` and `/moderation/revisions/*` routes let a caller with
`moderate` read a trashed post and its revisions. A caller without `moderate`
receives the 404 response. Purged and unknown posts receive 404 even for a
moderator. An anonymous request to a session-bearing route receives 401 with
`{"error":"UNAUTHORIZED"}`.

## Decision at completion

Protected material does not reveal whether its identifier exists. The
`student-notes:manage` capability grants staff-note access, and `moderate`
grants access to trashed posts and revisions. Neither capability grants access
after purge.

## Verification at completion

HTTP tests cover staff-only and unknown notes; every post, revision, and
satellite read; satellite mutations; a nonleaf purged post's placement; and
the moderation routes. They confirm the exact 200, 401, and 404 responses above
for an anonymous caller, an ordinary learner, a caller with
`student-notes:manage`, a caller with `moderate`, a trashed post, a purged post,
and unknown identifiers.
