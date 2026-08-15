# Moderation

A caller with moderation capability moves an existing post into trash through
[Forum.moderation.TrashItem](reaction:Forum.moderation.TrashItem). [Forum.moderation.RestoreItem](reaction:Forum.moderation.RestoreItem) restores a
trashed identity without recreating attached state. [Forum.moderation.PurgeItem](reaction:Forum.moderation.PurgeItem)
removes the trash record permanently and thereby triggers Forum-wide cleanup.
Trash and restore retain Posting and attached state; purge cleanup is
cross-concept and can be only partially complete if a later effect faults.

[Forum.moderation.TrashList](reaction:Forum.moderation.TrashList) gives moderators
[the retained trash bin](former:Forum.moderation.theTrashBin), including each record's timestamp. [Forum.moderation.IsTrashed](reaction:Forum.moderation.IsTrashed) lets moderators test one identity without
reading its content.
[Forum.moderation.GetTrashedPost](reaction:Forum.moderation.GetTrashedPost) returns retained post content only while the
post is trashed. These operations return `NOT_FOUND` to non-moderators so hidden
content and moderation state are not disclosed; the content read also hides
live and missing posts.

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
