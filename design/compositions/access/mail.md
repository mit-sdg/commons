# Mail

Mail gives administrators a window onto the outbox that Commons fills whenever
it decides to send an email, so a delivery that never lands is visible rather
than silent.

Commons renders and queues its own mail; a host worker drains that queue over
SMTP. When the transport rejects a message the worker records the reason
against it and leaves it queued, so the outbox accumulates both the messages
that went out and the ones that keep failing. Each enqueue has a fresh generation.
A worker acknowledges only the generation it attempted: if a resend replaces it
while SMTP is in flight, the older success or failure cannot consume or alter
the newer copy. SMTP Message-ID is stable for retries within one generation and
distinct for a resend. SMTP acceptance followed by an acknowledgement failure
can still duplicate delivery; this is not an exactly-once transport.

Only administrators may read the outbox.
[Access.mail.List](reaction:Access.mail.List) resolves the caller from the session, verifies
that the caller holds `administer`, and gives administrators
[the mail messages](former:Access.mail.theMailMessages) newest first. Each row carries the
recipient, subject, when it was queued, whether it was sent, how many delivery
attempts it has taken, and the reason the last attempt failed. The rendered body
is left out of the list to keep its response small. An administrator opens one
message through [Access.mail.Read](reaction:Access.mail.Read), which returns a
plain-text preview on demand. Invitation passwords, reset codes, and the tokens
in their links are redacted before the preview reaches the browser. Deduplication
keys stay server-side because authentication-mail keys contain those same link
identifiers. Raw mail HTML is not returned. An unknown message receives `NOT_FOUND`; all mail reads
refuse a non-administrator with `FORBIDDEN`.

## Invitation copy

An administrator words the invitation letter Commons sends. Wording keeps only
what they put there: Commons' own subject and body are the application's, held
in its computations, so an empty place is a real absence rather than a seeded
copy of a default nobody chose.

[Access.mail.Template](reaction:Access.mail.Template) returns the
[effective invitation template](former:Access.mail.theInvitationTemplate)
together with `worded`, which says whether those are an administrator's own
words or the ones Commons falls back to, so a reader is never left guessing
which it is looking at.
[The effective copy](view:Access.mail.invitationCopy) is the wording standing in
the `invitation` place, or Commons' own subject and body when none stands.
[Access.mail.SaveTemplate](reaction:Access.mail.SaveTemplate) words that place
with the subject and body together;
[Access.mail.ResetTemplate](reaction:Access.mail.ResetTemplate) withdraws the
wording so Commons' words come back. Both require `administer`.

The body is plain text, not HTML and not a substitution language: nothing inside
it is interpreted, so there is nothing in it for a template to expand. Subjects
must be nonempty single lines of at most 200 characters; bodies must be nonempty
and at most 20000 characters. Copy that breaks a rule is refused as
`INVALID_WORDING`, and the wording already standing is left whole — a refused
save never leaves a subject from one edit beside a body from another.

[Access.mail.PreviewTemplate](reaction:Access.mail.PreviewTemplate) forms a
[preview](former:Access.mail.theInvitationPreview) of unsaved copy through the
same renderers an invitation uses, with sample credentials, saving no wording
and queuing no message. A preview renders; it does not decide. It passes the
draft through the same fallback and bounds the effective copy meets, so it shows
at most what a save would accept and a blank draft previews the words Commons
would fall back to; only [SaveTemplate](reaction:Access.mail.SaveTemplate)
accepts or refuses copy. Both the text and the escaped HTML preview carry the
mandatory registration footer.

Wording changes affect subsequent invitation enqueues, including resends and
roster imports, but never rewrite a message already queued: what went out keeps
the words it went out with.

```endpoints
Access.mail.List at /mail/list
Access.mail.Read at /mail/read
Access.mail.Template at /mail/template
Access.mail.SaveTemplate at /mail/save-template
Access.mail.ResetTemplate at /mail/reset-template
Access.mail.PreviewTemplate at /mail/preview-template
```
