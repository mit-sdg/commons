# Threads

[Forum.threads.CreateThread](reaction:Forum.threads.CreateThread) resolves the session account, creates a Posting
post, and then places it as the root of a new conversation.
[Forum.threads.ReplyToThread](reaction:Forum.threads.ReplyToThread) uses
[placementOf](view:Forum.threads.placementOf) to find the parent's conversation and
[readableConversation](view:Forum.threads.readableConversation) to require that it remain unlocked,
then creates and places the reply. A locked
conversation returns `FORBIDDEN`, and a missing parent returns
`PARENT_NODE_NOT_FOUND` before post creation. The guard does not require a
Posting record for the parent or root, so a retained node can still accept
replies after that post is trashed or purged. Placement is a separate owner
action, so its refusal or fault after Posting creation can leave an unplaced
post.

A successful root placement triggers [Forum.threads.TrackRootUnread](reaction:Forum.threads.TrackRootUnread), which
registers the root in Tracking under its new conversation. A successful reply
placement triggers [Forum.threads.TrackReplyUnread](reaction:Forum.threads.TrackReplyUnread) for the same scope. Root
and reply placement independently trigger their notification rules, while the
preceding Posting return independently triggers formatting, links, and revision
history. These paths have no semantic priority or shared transaction: a refusal
or fault leaves earlier owner actions and successful sibling effects intact.
The author is not automatically marked as having seen the post.

[Forum.threads.ForItem](reaction:Forum.threads.ForItem) publicly returns the conversation containing a post or
`null`. It uses [publicTarget](view:Forum.threads.publicTarget) to resolve placement only while that post's Posting
record exists and is not trashed. Thread presentation forms
[the current thread](former:Forum.threads.theThread) by applying [intact](view:Forum.threads.intact) to each node
independently: a missing or trashed root is omitted without automatically hiding
intact replies.

```endpoints
Forum.threads.CreateThread at /threads/create
Forum.threads.ForItem at /threads/forItem
Forum.threads.ReplyToThread at /threads/reply
```
