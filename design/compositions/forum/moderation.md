# Moderation

A caller holding `moderate` moves one forum post or one whole conversation into
trash through [Forum.moderation.TrashItem](reaction:Forum.moderation.TrashItem);
the same identity field names either. Trashing a reply hides that post's content
and leaves its replies in place as a removed position. The opening post is never
trashed on its own: selecting it answers `THREAD_OPENING`, and the thread is
trashed by its conversation identity instead. A trashed conversation closes every
ordinary read, listing, notification, mail, and reply path for the whole thread at
once, while each post keeps its own trash state.
[Forum.moderation.RestoreItem](reaction:Forum.moderation.RestoreItem) restores a
trashed identity without recreating attached state. [Forum.moderation.PurgeItem](reaction:Forum.moderation.PurgeItem)
removes a trashed post permanently and thereby triggers Forum-wide cleanup.
Purging a trashed conversation purges each stored post through that same path and
then the conversation record; permanent cleanup then dissolves the structure and
ends its follows.
These routes reject unplaced Posting records, including assignment submission artifacts.
Trash and restore retain Posting and attached state; purge cleanup is
cross-concept and can be only partially complete if a later effect faults.

Trash, restore, and purge remain moderator-only and require current audience
membership; authors cannot use them merely because they own a post. Ordinary
Delete remains author-only and refuses posts with replies. Removing a reply
together with the replies beneath it is a sequence of single trash requests
issued by the interface, each independently restorable.

[Forum.moderation.TrashList](reaction:Forum.moderation.TrashList) gives moderators
[the retained trash bin](former:Forum.moderation.theTrashBin), including each record's timestamp. Each entry says whether it names a conversation and, when it does, which post opens it, so the bin can show a title without a live read. [Forum.moderation.IsTrashed](reaction:Forum.moderation.IsTrashed) lets moderators test one identity without
reading its content.
[Forum.moderation.GetTrashedPost](reaction:Forum.moderation.GetTrashedPost) returns retained post content only while the
post is trashed or its conversation is. These operations return `NOT_FOUND` to non-moderators so hidden
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

```endpoints
Forum.moderation.FlagRaise at /flags/raise
Forum.moderation.FlagResolve at /flags/resolve
Forum.moderation.FlagsForTarget at /flags/forTarget
Forum.moderation.FlagsOpen at /flags/open
Forum.moderation.GetTrashedPost at /moderation/posts/get
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

[Stored post presentation](former:Forum.moderation.theStoredPost) requires the moderator to belong to the post’s audience, including while the post or its conversation is trashed.
