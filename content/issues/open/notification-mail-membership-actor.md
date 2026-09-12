---
milestone: later
concepts:
  - Notifying
  - Grouping
---

# Name who changed a group membership in its notification mail

## Current behavior

Forum mail names the post's author and assignment mail names the assignment's
author, so a recipient can tell who caused the event. Group-membership mail
names only the list: "You were added to the group \"Reading Group\"."

The actor is not recoverable after the fact. `TaskNotifying.notify` records a
recipient, a kind, and a subject, and nothing else. `removedSomebodyElse` already
has to infer whether a removal was self-inflicted by re-reading the roster,
because nothing stored says who acted.

## Unresolved decision

Whether the acting identity belongs in the notification record at all. Carrying
an actor through `notify` widens a concept that is deliberately narrow, and the
inbox does not show an actor either, so the change is not confined to mail.
The alternative is to leave membership mail actorless and accept that it is the
one notification a recipient cannot attribute.

## Acceptance condition

Either membership mail names the member who added or removed the recipient, with
a test covering both directions, or the design records that membership events
are deliberately unattributed and says why.
