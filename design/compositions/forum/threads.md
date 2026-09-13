# Threads

[Forum.threads.CreateThread](reaction:Forum.threads.CreateThread) resolves the session account, validates its fixed complete audience, creates a Posting post, starts a conversation, then establishes its audience atomically. Until establishment succeeds, every forum read is closed to the conversation.

[Forum.threads.ReplyToThread](reaction:Forum.threads.ReplyToThread) requires current discussion access (audience membership or administration) and an untrashed, existing parent post before creating and placing a reply. A locked conversation returns `FORBIDDEN`; missing and inaccessible parents both return `NOT_FOUND`. Placement is a separate action, so its failure after Posting creation can leave an inaccessible unplaced post. [placementOf](view:Forum.threads.placementOf) and [readableConversation](view:Forum.threads.readableConversation) require the current reader.

The [forumPost view](view:Forum.threads.forumPost) distinguishes Posting records placed in a conversation from records used by other features, such as assignment artifacts. Forum read and moderation rules use this boundary so those other records do not become public posts merely because they share Posting storage.

A successful root placement triggers [Forum.threads.TrackRootUnread](reaction:Forum.threads.TrackRootUnread), which
registers the root in Tracking under its new conversation. A successful reply
placement triggers [Forum.threads.TrackReplyUnread](reaction:Forum.threads.TrackReplyUnread) for the same scope. Audience establishment triggers initial notifications; reply placement triggers reply notifications, while the
preceding Posting return independently triggers formatting, links, and revision
history. These paths have no semantic priority or shared transaction: a refusal
or fault leaves earlier owner actions and successful sibling effects intact.
The author is not automatically marked as having seen the post.

[Forum.threads.ForItem](reaction:Forum.threads.ForItem) returns to the session account the conversation containing a post or
`null`. It uses [publicTarget](view:Forum.threads.publicTarget) to resolve placement only while that post's Posting
record exists, is not trashed, and admits the current reader. Thread presentation forms
[the current thread](former:Forum.threads.theThread) by applying [intact](view:Forum.threads.intact) to each node
independently: a missing or trashed root is omitted without automatically hiding
intact replies.

```endpoints
Forum.threads.CreateThread at /threads/create
Forum.threads.ForItem at /threads/forItem
Forum.threads.ReplyToThread at /threads/reply
```

Creation uses Posting.create and Conversing.start, then establishes the complete holder set atomically. Before establishment the conversation admits nobody. [Invalid addressing](reaction:Forum.threads.CreateThreadDenied) is refused before creating a post. Reply requires [a readable parent](view:Forum.threads.replyParent).

```endpoints
Forum.threads.CreateThreadDenied at /threads/create
```
