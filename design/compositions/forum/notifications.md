# Notifications

A successful reply triggers [Forum.notifications.ReplyNotifiesParentAuthor](reaction:Forum.notifications.ReplyNotifiesParentAuthor)
when the reply author differs from the parent-post author. The same reply also triggers
[Forum.notifications.ReplyNotifiesWatchers](reaction:Forum.notifications.ReplyNotifiesWatchers) for conversation subscribers other
than the reply author, parent author, and anyone mentioned in the reply. Each
recipient is notified by an independent action; a fault does not roll back inbox
entries already stored for other recipients.

When a root audience is established, the
[otherUsersMentionedIn view](view:Forum.notifications.otherUsersMentionedIn) resolves each distinct exact username
mentioned in its content while excluding the author. [Forum.notifications.RootMentionsNotify](reaction:Forum.notifications.RootMentionsNotify)
notifies each resulting account that currently belongs to the audience. For a reply,
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
account email, checks audience access, resolves the
[current email context](view:Forum.notifications.notificationMailContext), and
queues an event-specific subject and message in Mailing. Emails name the event
and discussion title with a direct sign-in link, but contain no post-body excerpt.
Titles are rendered snapshots at enqueue time; current recipient access and the
queued account address are still checked before dispatch. The inbox
entry is already stored; a missing account email, rendering fault, queue refusal,
or later SMTP failure cannot retract it.

[Forum.notifications.ListNotifications](reaction:Forum.notifications.ListNotifications) forms
[the session account's retained notifications](former:Forum.notifications.theNotificationsOf).
[Forum.notifications.ReadInbox](reaction:Forum.notifications.ReadInbox) forms
[that account's private inbox](former:Forum.notifications.theInboxOf), enriching each entry with
[current post and public author presentation](former:Forum.notifications.theNotificationPresentationOf)
when those facts still exist. The
[discussion presentation](former:Forum.notifications.theDiscussionNotificationPresentation)
adds a conversation identity and title for direct navigation. Its
[context view](view:Forum.notifications.notificationDiscussion) uses only the
[readable opening](view:Forum.notifications.readableDiscussionOpening): a trashed
or purged opening cannot supply a title, even when a surviving reply is readable.
Such replies use the title `Discussion`, not an excerpt of a reply.
[Forum.notifications.UnreadCount](reaction:Forum.notifications.UnreadCount) returns the same account's current
unread count. A body value cannot select another recipient.

The recipient marks one owned inbox entry read through
[Forum.notifications.MarkRead](reaction:Forum.notifications.MarkRead). [Forum.notifications.MarkAllRead](reaction:Forum.notifications.MarkAllRead) marks all
of that recipient's currently readable entries read. [Forum.notifications.Dismiss](reaction:Forum.notifications.Dismiss) removes one inbox entry owned by that
recipient. Notifying checks ownership, so another account's
identifier is refused as missing.

Trash retains notifications while audience reads hide their content and metadata. Permanent purge triggers [Forum.notifications.PurgeClearsNotifications](reaction:Forum.notifications.PurgeClearsNotifications), deleting entries for that post. Residual entries after content deletion stay hidden.

```endpoints
Forum.notifications.Dismiss at /notifications/dismiss
Forum.notifications.ListNotifications at /notifications/list
Forum.notifications.MarkAllRead at /notifications/markAllRead
Forum.notifications.MarkRead at /notifications/markRead
Forum.notifications.ReadInbox at /notifications/inbox
Forum.notifications.UnreadCount at /notifications/unreadCount
```

[Current notification admission](view:Forum.notifications.readableNotification) filters inbox actions and [unread counts](former:Forum.notifications.theUnreadCount). [Mail eligibility](former:Forum.notifications.theMailEligibility) checks the recipient’s current audience access and queued address before dispatch.

```computations
forumMailKey(notification: String, recipient: String, post: String) : String
  Identifies a forum notification delivery with its recipient and source post for current audience checks.
```

[Starting a discussion notifies explicit account recipients](reaction:Forum.notifications.RootNotifiesAddressedAccounts), excluding the author and people already selected by the mention path. Group and section holders do not broadcast notifications to their members.

Private openings that explicitly include Staff trigger [RootNotifiesStaff](reaction:Forum.notifications.RootNotifiesStaff).
The [staff recipient rule](view:Forum.notifications.staffNotificationRecipient) uses the existing Staff audience membership and excludes [course-wide audiences](view:Forum.notifications.courseWideNotificationAudience).
The author is excluded; mentioned staff receive the mention notification instead, and explicitly addressed staff receive only the staff notification.
Current post access still gates notification creation, inbox visibility, and mail dispatch. This does not change who belongs to Staff or notify all staff for subsequent replies.

The existing Notifying instance also retains assignment release notifications.
[Subject admission](view:Forum.notifications.notificationSubjectReader) admits forum posts through postReader, or published assignments for their active student assignees whose accounts remain available.
Inbox reads, unread counts, mark-read, dismissal, and queued mail eligibility use that same admission.
[Assignment title lookup](view:Forum.notifications.assignmentNotificationTitle) provides the [assignment presentation](former:Forum.notifications.theAssignmentNotificationPresentation), with an assignment link rather than a forum-post link.
Release email names the assignment and event and links directly to the assignment;
it does not include assignment instructions. Mail is rechecked at dispatch; an
archived assignment or dropped student no longer admits its notification.
