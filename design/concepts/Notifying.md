# Notifying

## Purpose

Give each person an inbox of events that concern them, with actions to mark,
dismiss, or clear notifications.

## Principle

Someone replies to Mara's post, creating an unread notification that identifies
the event and its subject. Noah adds her to a list, creating a notification whose
subject names the list and whose actor names Noah, because a list cannot say who
changed her membership of it. Mara marks the first read, which lowers her unread
count without removing it. She later marks every notification read and dismisses
one. Dismissing it again is refused. Noah cannot read or dismiss Mara's
notifications.

## Types

```types
external Person
  An application-owned identity used in the person role.

external Subject
  An application-owned identity used in the subject role.

external Link
  An application-owned identity used in the link role.
```

## State

```state
a set of Notifications with
  a recipient Person
  a kind      String
  a subject   Subject
  an optional link Link
  an optional actor Person
  a createdAt Date

a set of Unread Notifications

Rule: a notification remains until its recipient dismisses it or clearSubject removes every notification about its subject.
Rule: an actor is the person whose act raised the notification, and is recorded only when the subject does not already say who that was.
Rule: actions that name a recipient operate only on that person's notifications, and another person's notification is refused as not found.
Rule: markAllRead and marking an already-read notification succeed without changing anything.
```

## Actions

```actions
notify(recipient: Person, kind: String, subject: Subject, link: Link, actor: Person, at: Date) : returns (notification: Notification)
  where true
  then
    add a new notification with recipient, kind, subject, link, actor, and createdAt at
    add notification to unread
    returns notification

markRead(notification: Notification, recipient: Person) : returns (notification: Notification)
  where notification in notifications and its recipient is recipient
  then
    remove notification from unread
    returns notification
  where no such notification of this recipient
  then
    refuses NOTIFICATION_NOT_FOUND "There is no such notification."

markAllRead(recipient: Person) : returns (recipient: Person)
  where true
  then
    remove every notification of recipient from unread
    returns recipient

dismiss(notification: Notification, recipient: Person) : returns (notification: Notification)
  where notification in notifications and its recipient is recipient
  then
    delete notification
    returns notification
  where no such notification of this recipient
  then
    refuses NOTIFICATION_NOT_FOUND "There is no such notification."

clearSubject(subject: Subject) : returns (subject: Subject)
  where true
  then
    delete every notification about subject
    returns subject
```

## Queries

```queries
_getInbox (recipient: String) : many (notification: String, kind: String, subject: Subject, link: Link|null, actor: Person|null, createdAt: Date, read: Flag)
  answers the recipient's notifications newest first, with later arrivals breaking equal-time ties
  answers no rows when none match

_getNotification (notification: String, recipient: String) : optional (kind: String, subject: Subject, link: Link|null, actor: Person|null, createdAt: Date, read: Flag)
  answers the notification when it belongs to the recipient
  answers no rows when it is missing or belongs to someone else

_hasFor (user: String, subject: Subject) : one (notified: Flag)
  answers whether the User has a Notification with this subject

_getUnreadCount (recipient: String) : one (count: Number)
  answers the number of the Recipient's unread Notifications
```
