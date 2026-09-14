# Thread subscriptions

A logged-in user follows a readable conversation through
[Forum.subscriptions.Subscribe](reaction:Forum.subscriptions.Subscribe). [Forum.subscriptions.Unsubscribe](reaction:Forum.subscriptions.Unsubscribe) removes the caller's follow from that
readable conversation. Subscribing refuses duplicate follows and repeated
removals. [Forum.subscriptions.MySubscriptions](reaction:Forum.subscriptions.MySubscriptions) forms
[the session account's currently readable follows](former:Forum.subscriptions.theSubscriptionsOf).
For a read that needs thread presentation, [theWatchedThreadsOf](former:Forum.subscriptions.theWatchedThreadsOf)
adds each followed conversation's root-post summary and current thread statistics.
[Forum.subscriptions.IsSubscribed](reaction:Forum.subscriptions.IsSubscribed)
reports that account's state for one readable conversation.

[Forum.subscriptions.Subscribers](reaction:Forum.subscriptions.Subscribers) forms
[the current followers](former:Forum.subscriptions.theSubscribersOf) only while the session account belongs to the conversation’s current audience. A trashed conversation hides subscription state with the rest of its thread; the records are retained, so restoring the conversation brings the follows back, and [purging it clears them](reaction:Forum.subscriptions.PurgeClearsThreadSubscriptions). Successful
replies consult the retained subscribers when creating followed-reply
notifications, with author and mention exclusions defined by notification
behavior.

Reply removal preserves following. A delayed following record cannot make an absent or trashed conversation readable.

```endpoints
Forum.subscriptions.IsSubscribed at /subscriptions/isSubscribed
Forum.subscriptions.MySubscriptions at /subscriptions/mine
Forum.subscriptions.Subscribe at /subscriptions/subscribe
Forum.subscriptions.Subscribers at /subscriptions/subscribers
Forum.subscriptions.Unsubscribe at /subscriptions/unsubscribe
```

[Purge clears conversation subscriptions](reaction:Forum.subscriptions.PurgeClearsConversationSubscriptions) when the root placement is still present and has no children.

[Starting follows the conversation](reaction:Forum.subscriptions.StartingFollowsConversation)
after its audience is established, using the ordinary subscribe action only
when the author is not already following. Replying, reading, and receiving notices
do not change following. An unfollowed conversation stays unfollowed until the
person explicitly follows it again.
