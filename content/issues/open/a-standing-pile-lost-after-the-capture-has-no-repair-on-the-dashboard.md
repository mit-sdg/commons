---
milestone: later
concepts:
  - Categorizing
  - Pinning
  - Guiding
  - Snapshotting
---

# A standing pile lost after a round's capture has no repair on the dashboard, and the Open answer waits for it

## Current behavior

Once a round's presentation is captured, reactions put the leg's standing piles on the round's wall: each pile is ensured on the wall and pinned among the reserved piles, and its definition is saved as sorting guidance, which the model sorter reads. These are separate writes after the capture. A fault or a crash between them leaves the round open to the room without its standing pile, with the pile unpinned, or with the pile but without its saved definition.

The server has a repair for the first two: a press of Open on the round already open ensures a missing pile again, with its definition, and pins an unpinned one. The dashboard does not offer that press, since it offers only Close while a round is open, and no screen says a pile is missing. No press restores a definition lost after its pile was written; it stays missing for the rest of the round. The lecturer can add the pile by hand.

Beside it, the same writes hold the Open answer, because a request is answered only once everything its flow set off has settled. Phones already have the round, but a write to a standing pile that takes five seconds delays the lecturer's answer by five seconds, and a write that hangs answers an error after thirty seconds for a round that opened.

## Unresolved decision

Where the repair lives: on the dashboard, as a control or a line that shows a standing pile is missing; in the participant worker's pass, which already visits every round open to the room; or in the round's own writes, with the standing piles written with the round itself so no gap follows the capture. The last would also take the piles out of what the Open answer waits for.

## Acceptance condition

With a fault or a crash at each of a standing pile's writes (the pile, its pin, its definition), the round ends with every standing pile on its wall, pinned and defined, without any request the dashboard does not make; and a slow or hung write there neither delays the Open answer nor turns it into an error for a round that opened.
