---
milestone: later
concepts:
  - Sessioning
---

# A session ends one day after sign-in whatever the holder is doing

## Current behavior

Sessioning gives a session an expiry one day after it starts, and nothing
extends it: a request that finds a live session does not move its expiry.
A staff member who signs in the evening before a class meets the expiry
during it, on a dashboard that polls and acts with the session on every
request; a student signed into Commons on their phone meets it on the
signed participation endpoints, which refuse a response the session no
longer owns. The screens now say so and offer to sign in again in place
(the dashboard, the projector, and the phone), so an expiry mid-run costs
a sign-in and loses nothing held on the server, but it still interrupts.

## Unresolved decision

Whether Sessioning grows a sliding expiry — each use pushes the expiry
forward by the idle allowance, under an absolute cap — and what the two
spans are; or whether the fixed day stays and the screens' in-place sign-in
is the designed answer.

## Acceptance condition

A session in active use never expires under its holder, or a recorded
decision keeps the fixed expiry and names the in-place sign-in as the
answer. Sign-out and ending every session for a user keep working as they
do.
