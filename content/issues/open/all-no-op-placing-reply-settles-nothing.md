---
milestone: later
concepts:
  - Suggesting
  - Insisting
---

# A placing reply made only of no-op lines is refused as an empty offering

## Current behavior

A `place` line naming a card already in the pile it names is a no-op line,
dropped from the reading, so a reply that repeats placements the wall
already holds is not stood upon. A reply made only of such lines reads as
`placed` with no lines, and the reaction that offers the lines asks
Suggesting with an empty list, which refuses `NOTHING_OFFERED`. The reaction
that settles an insistence watches the offer, so an insistence standing about
the round stays standing until the next usable reply. The tick is not held;
the state was reachable before the no-op line existed, through an empty tray
answered with no placements.

## Unresolved decision

Whether the reading should answer a distinct kind for "nothing to place" that
settles the insistence without an offering, or whether the offer reaction
should skip an empty list.

## Acceptance condition

A reply that places nothing new leaves no insistence standing about the
round.
