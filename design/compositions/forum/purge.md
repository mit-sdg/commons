# Permanent forum cleanup

A moderator starts permanent cleanup by purging Trashing's record.
[Forum.purge.PurgeClearsCoreForumState](reaction:Forum.purge.PurgeClearsCoreForumState) reacts to that return with independent
requests to delete the Posting record, rendered content, forward and backward
links, flags, the post's own lock, and unread registration.

When the post is the root, the reaction also removes its conversation lock. If
Posting is already absent, it asks Conversing to remove a leaf node; otherwise
successful Posting deletion delegates that request to ordinary post cleanup. A
node with children is preserved. Other purge reactions clear their own
organization, personal, revision, resolution, and notification state;
conversation subscriptions are cleared only when the purged post is the root.

The cleanup requests are sibling paths, not an ordered transaction, and some
idempotent work overlaps. The trash transition remains committed when a cleanup
refuses or faults. If Posting deletion fails, the absent trash marker can make
the retained post readable again; Commons does not retry the cleanup
automatically.
