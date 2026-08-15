# Thread subscriptions

A logged-in user follows a readable conversation through
[Forum.subscriptions.Subscribe](reaction:Forum.subscriptions.Subscribe). [Forum.subscriptions.Unsubscribe](reaction:Forum.subscriptions.Unsubscribe) removes the caller's follow from that
readable conversation. Subscribing refuses duplicate follows and repeated
removals. [Forum.subscriptions.MySubscriptions](reaction:Forum.subscriptions.MySubscriptions) returns only the session
account's currently readable follows. [Forum.subscriptions.IsSubscribed](reaction:Forum.subscriptions.IsSubscribed)
reports that account's state for one readable conversation.

[Forum.subscriptions.Subscribers](reaction:Forum.subscriptions.Subscribers) publicly lists followers only while the
conversation remains readable. A trashed or deleted root therefore hides the
subscription state without removing it; restore can reveal it again. Successful
replies consult the retained subscribers when creating followed-reply
notifications, with author and mention exclusions defined by notification
behavior.

Purging a placed root triggers
[Forum.subscriptions.PurgeClearsConversationSubscriptions](reaction:Forum.subscriptions.PurgeClearsConversationSubscriptions), which clears every
subscription to that conversation. Purging a reply leaves the conversation's
subscriptions intact. The Trashing transition remains committed if root lookup
or cleanup faults, so retained subscribers can still receive later reply
notifications.

## Supporting declarations

Formers [theSubscribersOf](former:Forum.subscriptions.theSubscribersOf), [theSubscriptionsOf](former:Forum.subscriptions.theSubscriptionsOf), [theWatchedThreadsOf](former:Forum.subscriptions.theWatchedThreadsOf) support the behavior and result shapes described above.
