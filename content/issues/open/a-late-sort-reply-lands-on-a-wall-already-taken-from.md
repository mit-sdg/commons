---
milestone: later
concepts:
  - Reasoning
  - Categorizing
---

# A late sort reply lands on a wall a later round already took from

## Current behavior

Closing a round with the model sorting sends a placing ask for the cards still in the tray. When the reasoner hangs and the host sorts by hand, picks, and opens the next round, the next round takes the hand-made piles. When the hung ask later returns, its reply is applied to the closed round's wall: it adds the model's piles beside the picked hand piles. The next round's presentation is fixed, so phones are unaffected, but the closed wall now shows piles the next round never took, with nothing marking them as late. A reasoner that errors or cannot be reached leaves nothing to land.

## Unresolved decision

Whether a placing reply that returns after a later round has taken from its wall is applied, recorded as late and shown so, or dropped with its ask marked failed.

## Acceptance condition

After a later round takes from a wall, a reply that returns for that wall either leaves it as it was or is marked on the wall as having arrived after the take; a scenario with a hung reasoner that later answers checks it.
