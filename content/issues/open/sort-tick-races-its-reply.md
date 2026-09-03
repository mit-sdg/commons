---
milestone: later
concepts:
  - Reasoning
---

# A sort tick can ask again before the last reply's placements land

## Current behavior

The dashboard asks the wall to sort every three seconds. The endpoint asks
only while no ask about the round is pending and nothing is being insisted
on, but a reply that has just landed is taken by reactions in a flow of its
own, so a tick that arrives in the gap — measured at 37 ms after the reply —
sends a passage that still lists the cards the reply just placed. The model
answers that stale passage correctly, the reading finds those cards no longer
in the tray, and the reply is stood upon for nothing: two extra model calls
and up to twenty seconds on one wall in twenty.

## Unresolved decision

Whether the endpoint should also require that no offering about the round is
still untaken, or whether the reading should accept a placement of a card
already in the pile it names as a no-op line rather than a bad reply.

## Acceptance condition

Twenty walls sorted on the three-second cadence produce no insistence whose
account is a card "waiting in the tray" that the wall already holds.
