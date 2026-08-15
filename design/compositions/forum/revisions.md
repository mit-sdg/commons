# Revision history

Every successful Posting creation triggers
[Forum.revisions.RecordRevisionOnCreate](reaction:Forum.revisions.RecordRevisionOnCreate), which records the supplied content
and creation time as the next revision. Every successful edit triggers
[Forum.revisions.RecordRevisionOnEdit](reaction:Forum.revisions.RecordRevisionOnEdit) with the new content and edit time. The
history action is independent of Posting: if recording faults, the post or edit
remains committed and no later rule backfills the missing revision. Submission
artifacts receive the same treatment because they also use Posting.

For a live, untrashed post, [Forum.revisions.ListRevisions](reaction:Forum.revisions.ListRevisions) returns its
complete numbered history. [Forum.revisions.GetRevision](reaction:Forum.revisions.GetRevision) returns a zero-or-one-element result for one
requested number. [Forum.revisions.LatestRevision](reaction:Forum.revisions.LatestRevision) likewise returns the
highest-numbered entry or an empty result when no history exists. A trashed or
missing Posting record is `NOT_FOUND`, even if Revising still retains rows.

While a post is trashed,
[Forum.revisions.ModeratorListRevisions](reaction:Forum.revisions.ModeratorListRevisions) gives a moderator its history.
[Forum.revisions.ModeratorGetRevision](reaction:Forum.revisions.ModeratorGetRevision) gives that moderator a zero-or-one
result for one number in the hidden history.
[Forum.revisions.ModeratorLatestRevision](reaction:Forum.revisions.ModeratorLatestRevision) gives the newest entry or an empty
result when that history is empty. These paths
hide results from non-moderators and deliberately reject live or missing posts
as `NOT_FOUND`.

Permanent purge triggers [Forum.revisions.PurgeClearsRevisions](reaction:Forum.revisions.PurgeClearsRevisions) and removes the
complete history. Ordinary author deletion does not, so unexposed revision rows
can remain after Posting has gone.

## Supporting declarations

Formers [theLatestRevisionOf](former:Forum.revisions.theLatestRevisionOf), [theRevisionHistoryOf](former:Forum.revisions.theRevisionHistoryOf), [theRevisionNumberedOf](former:Forum.revisions.theRevisionNumberedOf) support the behavior and result shapes described above.
