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

an Unread set of Notifications

Rule: a notification remains until its recipient dismisses it or clearSubject removes every notification about its subject.
Rule: an actor is the person whose act raised the notification, and is recorded only when the subject does not already say who that was.
Rule: actions that name a recipient operate only on that person's notifications, and another person's notification is refused as not found.
Rule: markAllRead and marking an already-read notification succeed without changing anything.
```

## Actions

```actions
notify(recipient: Person, kind: String, subject: Subject, link: Link, actor: Person, at: Date) : return (notification: Notification)
  where true
  then
    add a new notification with recipient, kind, subject, link, actor, and createdAt at
    add notification to unread
    return notification

markRead(notification: Notification, recipient: Person) : return (notification: Notification)
  where notification in notifications and its recipient is recipient
  then
    remove notification from unread
    return notification
  where no such notification of this recipient
  then
    refuse NOTIFICATION_NOT_FOUND "There is no such notification."

markAllRead(recipient: Person) : return (recipient: Person)
  where true
  then
    remove every notification of recipient from unread
    return recipient

dismiss(notification: Notification, recipient: Person) : return (notification: Notification)
  where notification in notifications and its recipient is recipient
  then
    delete notification
    return notification
  where no such notification of this recipient
  then
    refuse NOTIFICATION_NOT_FOUND "There is no such notification."

clearSubject(subject: Subject) : return (subject: Subject)
  where true
  then
    delete every notification about subject
    return subject
```

## Queries

```queries
_getInbox (recipient: String) : many (notification: String, kind: String, subject: Subject, link: Link|Null, actor: Person|Null, createdAt: Date, read: Boolean)
  answers the recipient's notifications newest first, with later arrivals breaking equal-time ties
  answers no rows when none match

_hasFor (user: String, subject: Subject) : one (notified: Boolean)
  answers whether the User has a Notification with this subject

_getUnreadCount (recipient: String) : one (count: Number)
  answers the number of the Recipient's unread Notifications
```
