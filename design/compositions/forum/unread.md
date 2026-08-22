# Unread tracking

[Forum.unread.UnreadList](reaction:Forum.unread.UnreadList) forms
[the session account's unseen registered items](former:Forum.unread.theUnreadOf) in one scope. [Forum.unread.UnreadCount](reaction:Forum.unread.UnreadCount) returns their count for that
same account and scope. Both
use the account resolved from the session; a request cannot inspect another
user's seen marks.

[Forum.unread.MarkSeen](reaction:Forum.unread.MarkSeen) records that the session account saw one registered
item. Tracking refuses an unknown item or a repeated mark.
[Forum.unread.MarkAllSeen](reaction:Forum.unread.MarkAllSeen) marks every currently registered item in the scope
and succeeds even when none remain. There is no operation that makes a seen item
unread.

Thread placement registers roots and replies; ordinary deletion and permanent
purge unregister a post and remove all of its seen marks. Trash alone does not
unregister it. These reads do not apply post readability, so they can continue
to return the identity of a trashed post until it is restored or purged.

```endpoints
Forum.unread.MarkAllSeen at /unread/markAllSeen
Forum.unread.MarkSeen at /unread/markSeen
Forum.unread.UnreadCount at /unread/count
Forum.unread.UnreadList at /unread/list
```
