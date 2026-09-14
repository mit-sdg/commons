# Moderation

Trash operations and inspection require a moderator in the current audience;
post ownership alone is insufficient. Unplaced Posting records, including
assignment submission artifacts, are not forum targets. Ordinary Delete remains
author-only and refuses posts with replies.

[Forum.moderation.TrashItem](reaction:Forum.moderation.TrashItem) accepts a reply
or a conversation identity. Trashing a reply hides its text and leaves a removed
notice, even for a leaf; replies beneath it stay visible. Trashing a conversation
closes ordinary reads, listings, notifications, mail, and reply actions for the
whole thread, even for moderators. Trashing an opening post alone returns
`THREAD_OPENING`; use its conversation identity instead.

Trash retains Posting and attached state.
[Forum.moderation.RestoreItem](reaction:Forum.moderation.RestoreItem) clears only
the selected marker: restoring a thread does not restore separately trashed
replies, and restoring a reply does not restore its thread. The post menu and
flag queue share a confirmation for trashing a reply and its selected descendants
as individual requests. The selection is captured when the confirmation opens;
later replies are excluded, and failed requests are reported.

[Forum.moderation.PurgeItem](reaction:Forum.moderation.PurgeItem) permanently
deletes a trashed reply, or each stored post in a trashed conversation.
[Forum.moderation.FinishThreadPurge](reaction:Forum.moderation.FinishThreadPurge)
waits for per-post work to settle and verifies that the
[thread has no unfinished post deletions](view:Forum.moderation.unfinishedThreadPurge)
before purging the conversation's trash record. Failed post deletions leave the
thread hidden and in the bin. Reply purges remain retryable when only the trash
record survives. A partially purged thread can still be restored, but deleted
content stays absent. Cleanup can remain partial if a later effect fails; see
[permanent cleanup](purge.md).

[Forum.moderation.TrashList](reaction:Forum.moderation.TrashList) returns
[the trash bin](former:Forum.moderation.theTrashBin) with each entry's kind,
attribution, and timestamp. Conversation entries identify their opening post;
bin controls remain available if its content cannot load.
[Forum.moderation.IsTrashed](reaction:Forum.moderation.IsTrashed) reports one
identity's trash state without reading its content.
[Forum.moderation.GetTrashedPost](reaction:Forum.moderation.GetTrashedPost) returns
retained content for a trashed post or a post in a trashed conversation.
[Forum.moderation.GetTrashedThread](reaction:Forum.moderation.GetTrashedThread)
provides read-only review of [the stored thread](former:Forum.moderation.theStoredThread):
its outline, [retained post content](former:Forum.moderation.theStoredPost), and
each reply's trash state. Deleted content is blank; its position remains.
These reads return `NOT_FOUND` to non-moderators; content reads also reject live
and missing targets.

The startup migration moves old retained opening-post trash markers to their
conversation identity, preserving who and when and every separate reply marker.
An already-destroyed opening cannot be migrated losslessly: startup reports the
affected identities for explicit operator repair without deleting surviving replies.

[Forum.moderation.LockTarget](reaction:Forum.moderation.LockTarget) lets a moderator lock a currently public post or
conversation. [Forum.moderation.UnlockTarget](reaction:Forum.moderation.UnlockTarget) removes that lock only while the
target remains public. Only a conversation lock is consulted by reply and edit
policy; a direct post lock is recorded but does not currently block either.
[Forum.moderation.LockList](reaction:Forum.moderation.LockList) forms
[the public lock list](former:Forum.moderation.theLockedList) from locks whose targets are still public. [Forum.moderation.IsLocked](reaction:Forum.moderation.IsLocked) reports one public target's status while
hiding a missing or trashed target.

Any logged-in account raises one open concern on a live post through
[Forum.moderation.FlagRaise](reaction:Forum.moderation.FlagRaise); Flagging refuses a second open concern from the
same account and target. A moderator closes all open flags on a readable target
as upheld or dismissed through [Forum.moderation.FlagResolve](reaction:Forum.moderation.FlagResolve).
[Forum.moderation.FlagsOpen](reaction:Forum.moderation.FlagsOpen) forms
[the open-flag counts](former:Forum.moderation.theOpenFlags) for readable targets.
For a richer moderation read, [theModerationQueue](former:Forum.moderation.theModerationQueue) joins those targets
with current post, rendering, placement, and individual flag details without storing a queue snapshot.
[Forum.moderation.FlagsForTarget](reaction:Forum.moderation.FlagsForTarget) forms
[all flags retained for one readable post](former:Forum.moderation.theFlagsOn).
Both reads hide their results from non-moderators as `NOT_FOUND`.

```endpoints
Forum.moderation.FlagRaise at /flags/raise
Forum.moderation.FlagResolve at /flags/resolve
Forum.moderation.FlagsForTarget at /flags/forTarget
Forum.moderation.FlagsOpen at /flags/open
Forum.moderation.GetTrashedPost at /moderation/posts/get
Forum.moderation.GetTrashedThread at /moderation/threads/get
Forum.moderation.FinishThreadPurge at /trash/purge
Forum.moderation.IsLocked at /locks/isLocked
Forum.moderation.IsTrashed at /trash/isTrashed
Forum.moderation.LockList at /locks/list
Forum.moderation.LockTarget at /locks/lock
Forum.moderation.PurgeItem at /trash/purge
Forum.moderation.RestoreItem at /trash/restore
Forum.moderation.TrashItem at /trash/trash
Forum.moderation.TrashList at /trash/list
Forum.moderation.UnlockTarget at /locks/unlock
```
