# Notifications

A successful reply triggers [Forum.notifications.ReplyNotifiesParentAuthor](reaction:Forum.notifications.ReplyNotifiesParentAuthor)
when the reply author differs from the parent-post author. The same reply also triggers
[Forum.notifications.ReplyNotifiesWatchers](reaction:Forum.notifications.ReplyNotifiesWatchers) for conversation subscribers other
than the reply author, parent author, and anyone mentioned in the reply. Each
recipient is notified by an independent action; a fault does not roll back inbox
entries already stored for other recipients.

When a root post is placed, the
[otherUsersMentionedIn view](view:Forum.notifications.otherUsersMentionedIn) resolves each distinct exact username
mentioned in its content while excluding the author. [Forum.notifications.RootMentionsNotify](reaction:Forum.notifications.RootMentionsNotify)
notifies each resulting account. For a reply,
[Forum.notifications.ReplyMentionsNotify](reaction:Forum.notifications.ReplyMentionsNotify) applies the same rule, using
[isNotMentionedIn](view:Forum.notifications.isNotMentionedIn) to suppress the parent author who receives the
reply notification instead. [Forum.notifications.EditMentionsNotify](reaction:Forum.notifications.EditMentionsNotify)
uses [isNotYetNotifiedAbout](view:Forum.notifications.isNotYetNotifiedAbout) so an edit notifies a mentioned
account only when that account has no notification of any kind whose subject is that post. These checks reduce duplicate inbox entries but do not merge events
already stored.

Accepting an answer triggers
[Forum.notifications.AcceptNotifiesAnswerAuthor](reaction:Forum.notifications.AcceptNotifiesAnswerAuthor) unless the accepting account
also wrote the answer. Every successful Notifying action then triggers
[Forum.notifications.NotificationQueuesEmail](reaction:Forum.notifications.NotificationQueuesEmail), which looks up the recipient's
account email, renders the Commons message, and queues it in Mailing. The inbox
entry is already stored; a missing account email, rendering fault, queue refusal,
or later SMTP failure cannot retract it.

[Forum.notifications.ListNotifications](reaction:Forum.notifications.ListNotifications) forms
[the session account's retained notifications](former:Forum.notifications.theNotificationsOf).
[Forum.notifications.ReadInbox](reaction:Forum.notifications.ReadInbox) forms
[that account's private inbox](former:Forum.notifications.theInboxOf), enriching each entry with
[current post and public author presentation](former:Forum.notifications.theNotificationPresentationOf)
when those facts still exist. [Forum.notifications.UnreadCount](reaction:Forum.notifications.UnreadCount) returns the same account's current
unread count. A body value cannot select another recipient.

The recipient marks one owned inbox entry read through
[Forum.notifications.MarkRead](reaction:Forum.notifications.MarkRead). [Forum.notifications.MarkAllRead](reaction:Forum.notifications.MarkAllRead) marks all
of that recipient's entries read. [Forum.notifications.Dismiss](reaction:Forum.notifications.Dismiss) removes one inbox entry owned by that
recipient. Notifying checks ownership, so another account's
identifier is refused as missing.

Trash keeps both the notification and its retained post presentation because
this inbox join does not apply public-readability filtering. Permanent purge
triggers [Forum.notifications.PurgeClearsNotifications](reaction:Forum.notifications.PurgeClearsNotifications), which deletes every
notification whose subject is that post. Ordinary author deletion can remove
the post presentation but does not run this subject cleanup.
