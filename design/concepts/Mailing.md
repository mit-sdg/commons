# Mailing

## Purpose

Keep a durable outbox of email messages that the application has decided to
send, independently of the SMTP transport that delivers them.

## Principle

An application queues an email it has already rendered. A host worker reads
queued messages, sends them through SMTP, and marks successful deliveries sent.
A failed delivery is recorded against the message with the reason it failed;
the message remains queued for a later attempt, so an operator can see which
mail is not getting through and why.

## Types

```types
external Key
  An application-owned identity used in the key role.
```

## State

```state
a set of Messages with
  a key       Key
  an optional generation String
  a recipient String
  a subject   String
  a text      String
  an html     String
  a createdAt Date
  an optional sentAt Date
  an attempts Number
  an optional lastAttemptAt Date
  an optional lastError String

Rule: a key identifies one logical message.
Rule: enqueuing the same key coalesces pending copies; enqueuing it after delivery deliberately queues that logical message again with its latest content.
Rule: email recipients are compared after trimming and lower-casing.
Rule: each enqueue creates a fresh generation; a delivery outcome changes only that generation. Messages queued before generation tracking use null until enqueued again.
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
    add the message with a fresh generation, its normalized recipient, no sentAt, and no attempts
    return message
  where recipient looks like an email address and a message already has key
  then
    atomically assign a fresh generation, clear its sentAt, attempts, and failure, and replace its delivery content using the normalized recipient
    return message
  where recipient does not look like an email address
  then
    refuse MAIL_RECIPIENT_INVALID "The mail recipient is not well formed."

markSent(message: Message, generation: String|Null, at: Date) : return (message: Message)
  where message exists and generation is current
  then
    atomically set sentAt to at and clear lastError for that generation
    return message
  where message exists and generation is no longer current
  then
    leave the newer enqueue and its delivery outcome unchanged
    return message
  where message does not exist
  then
    refuse MAIL_NOT_FOUND "There is no such mail message."

markFailed(message: Message, generation: String|Null, error: String, at: Date) : return (message: Message)
  where message exists and generation is current
  then
    atomically count one more failed attempt, set lastAttemptAt to at, and set lastError to error for that generation
    leave sentAt alone so the message stays queued for a later attempt
    return message
  where message exists and generation is no longer current
  then
    leave the newer enqueue and its delivery outcome unchanged
    return message
  where message does not exist
  then
    refuse MAIL_NOT_FOUND "There is no such mail message."
```

## Queries

```queries
_getPending () : many (message: String, key: Key, generation: String|Null, recipient: String, subject: String, text: String, html: String, createdAt: Date)
  answers every Message not marked sent with its current generation for conditional delivery acknowledgement
  orders rows by creation
  answers no rows when none match

_getStatus (message: String) : optional (sentAt: Date|Null)
  answers the Message's sent time, or null while it is pending
  answers no row when the Message does not exist

_getMessage (message: String) : optional (key: Key, subject: String, recipient: String, text: String)
  answers one Message's key, subject, recipient, and rendered plain text for inspection and source access checks
  answers no row when that Message does not exist

_getMessages () : many (message: String, key: Key, recipient: String, subject: String, createdAt: Date, sentAt: Date|Null, attempts: Number, lastAttemptAt: Date|Null, lastError: String|Null)
  answers every Message with its delivery outcome, newest first
  omits the rendered body so the outbox can be listed cheaply
  answers no rows when none match
```
