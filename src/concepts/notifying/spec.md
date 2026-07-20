# Notifying

## Purpose

Give each person an inbox of events that concern them, with actions to mark,
dismiss, or clear notifications.

## Principle

Someone replies to Mara's post, creating an unread notification that identifies
the event and its subject. Mara marks it read, which lowers her unread count
without removing it. She later marks every notification read and dismisses one.
Dismissing it again is refused. Noah cannot read or dismiss Mara's
notifications.

## State

```state
a set of Notifications with
  a recipient Person
  a kind      String
  a subject   String
  an optional link String
  a createdAt Date

an Unread set of Notifications
```

A notification remains until its recipient dismisses it or `clearSubject`
removes every notification about its subject.

## Actions

```actions
notify (recipient: Person, kind: String, subject: String, link: String, at: Date) : return (notification: Notification)
  then
    add a new notification with recipient, kind, subject, link, and createdAt at
    add notification to unread
    return notification

markRead (notification: Notification, recipient: Person) : return (notification: Notification), refuse (message: String)
  where notification in notifications and its recipient is recipient
  then
    remove notification from unread
    return notification
  where no such notification of this recipient
  then
    refuse "There is no such notification."

markAllRead (recipient: Person) : return (recipient: Person)
  then
    remove every notification of recipient from unread
    return recipient

dismiss (notification: Notification, recipient: Person) : return (notification: Notification), refuse (message: String)
  where notification in notifications and its recipient is recipient
  then
    delete notification
    return notification
  where no such notification of this recipient
  then
    refuse "There is no such notification."

clearSubject (subject: Target) : return (subject: Target)
  then
    delete every notification about subject
    return subject
```

Actions that name a recipient operate only on that person's notifications.
Another person's notification is refused as not found. `markAllRead` and
marking an already-read notification succeed without changing anything.

## Questions

- `_getInbox (recipient)` answers the recipient's notifications newest first,
  with later arrivals breaking equal-time ties.
- `_hasFor (user, subject)` answers exactly one row with `notified`.
- `_getUnreadCount (recipient)` answers exactly one row with `count`.
