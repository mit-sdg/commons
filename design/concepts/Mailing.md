# Mailing

## Purpose

Keep a durable outbox of email messages that the application has decided to
send, independently of the SMTP transport that delivers them.

## Principle

An application queues an email it has already rendered. A host worker reads
queued messages, sends them through SMTP, and marks successful deliveries sent.
Failed messages remain queued for a later attempt.

## Types

```types
external Key
  An application-owned identity used in the key role.
```

## State

```state
a set of Messages with
  a key       Key
  a recipient String
  a subject   String
  a text      String
  an html     String
  a createdAt Date
  an optional sentAt Date

Rule: a key identifies one logical message.
Rule: enqueuing the same key coalesces pending copies; enqueuing it after delivery deliberately queues that logical message again with its latest content.
Rule: email recipients are compared after trimming and lower-casing.
```

## Actions

```actions
normalizeRecipient(recipient: String) : return (recipient: String)
  where recipient looks like an email address
  then
    return recipient
  where recipient does not look like an email address
  then
    refuse MAIL_RECIPIENT_INVALID "The mail recipient is not well formed."

enqueue(key: Key, recipient: String, subject: String, text: String, html: String, at: Date) : return (message: Message)
  where recipient looks like an email address and no message has key
  then
    add the message with its normalized recipient and no sentAt
    return message
  where recipient looks like an email address and a message already has key
  then
    clear its sentAt and replace its delivery content using the normalized recipient
    return message
  where recipient does not look like an email address
  then
    refuse MAIL_RECIPIENT_INVALID "The mail recipient is not well formed."

markSent(message: Message, at: Date) : return (message: Message)
  where message exists
  then
    set sentAt to at
    return message
  where message does not exist
  then
    refuse MAIL_NOT_FOUND "There is no such mail message."
```

## Queries

```queries
_getPending () : many (message: String, key: Key, recipient: String, subject: String, text: String, html: String, createdAt: Date)
  answers every Message not marked sent
  orders rows by creation
  answers no rows when none match

_getStatus (message: String) : optional (sentAt: Date|Null)
  answers the Message's sent time, or null while it is pending
  answers no row when the Message does not exist
```
