# Mail

Mail gives administrators a window onto the outbox that Commons fills whenever
it decides to send an email, so a delivery that never lands is visible rather
than silent.

Commons renders and queues its own mail; a host worker drains that queue over
SMTP. When the transport rejects a message the worker records the reason
against it and leaves it queued, so the outbox accumulates both the messages
that went out and the ones that keep failing.

Only administrators may read the outbox.
[Access.mail.List](reaction:Access.mail.List) resolves the caller from the session, verifies
that the caller holds `administer`, and gives administrators
[the mail messages](former:Access.mail.theMailMessages) newest first. Each row carries the
recipient, subject, when it was queued, whether it was sent, how many delivery
attempts it has taken, and the reason the last attempt failed. The rendered body
is deliberately left out: the list is a delivery log, not a mail reader, and
omitting it keeps the response small. A non-administrator receives `FORBIDDEN`.

```endpoints
Access.mail.List at /mail/list
```
