---
milestone: later
concepts:
  - Responding
---

# A phone's join names its run, not the round it means

## Current behavior

A phone joins a relay round with `/live/p/begin {token, device}` (or the signed form), and the server begins a response on whatever round of the run is open when the request is taken. The answer carries the response but not its round. A join delayed across a close and an open is taken on the next round, and the phone, still showing the round it asked about, has no round in the answer to check against.

## Unresolved decision

Whether a join names the round it means and is refused when that round is no longer open, or answers the round it began so the phone can compare it with the round it shows.

## Acceptance condition

A join delayed across a close and an open, and answered out of order, never leaves a phone answering a round other than the one it shows; every response and every draft on the device belongs to the displayed round.
