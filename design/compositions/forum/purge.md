# Permanent forum cleanup

An audience-authorized moderator deletes the trashed Posting content before purging Trashing's record. If deletion fails, the content remains trashed.
[Forum.purge.PurgeClearsCoreForumState](reaction:Forum.purge.PurgeClearsCoreForumState) reacts to that return with independent
requests to delete the Posting record, rendered content, forward and backward
links, flags, the post's own lock, and unread registration.

When the post is the root, the reaction also removes its conversation lock.
A reply purged through moderation keeps its structural position even when it is
a leaf; its text is destroyed, its removed notice remains, and its own replies
stay readable. Ordinary author deletion still removes a leaf entirely.
Other purge reactions clear their own
organization, personal, revision, resolution, and notification state;
conversation subscriptions are cleared only when the purged post is a root without children.

[Purging a conversation](reaction:Forum.purge.PurgeDissolvesConversation) dissolves
its remaining nodes and conversation record, removes its lock, and retires its
audience grant, only after the moderation route has waited for its per-post work
to settle and verified that no post content or post trash records remain. Subscription behavior ends its follows at the same time.

Cleanup reactions have independent sibling paths. A failure can leave residual records, but audience reads require the underlying post to exist, so those records cannot restore access to purged content. Automatic completion after failure remains an open application issue.
