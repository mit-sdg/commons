---
milestone: later
concepts:
  - Categorizing
---

# A chip held over a pile while a reply lands drops a different card

## Current behavior

The tray's chips are keyed by their place on the shelf. When the model's
placing reply lands while a chip is held mid-drag, the belt places the
lifted card in its pile and the chip's node comes to carry the next
unsorted card. The drop then sends a move for the card the node carries at
that moment, not the card the pointer went down on: the keyboard-and-hand
scenario (`tests/robustness/scenarios/r17-tray-by-hand-and-keyboard.ts` on
the `release-testing` branch, adapted to the current switch label) lifted
one card, the reply placed it 1.4 s in, and the drop moved another card into
the pile. The wall stayed consistent with the floor and no card was lost;
the host's intent for the lifted card was not carried out and a second card
moved without a gesture for it. Seen once under the 2026-09-15 repair pass
sweep (`evaluation/live-performance/repair/scenarios/repair-r17-adapted-again/`
in the design workspace).

## Unresolved decision

Whether a drag should hold the card's identity from pointer-down (so the drop
moves that card, or does nothing if the belt placed it meanwhile), or whether
the belt should leave a held chip alone until the drag ends.

## Acceptance condition

A drop moves exactly the card that was lifted, or nothing when that card was
placed while it was held; no other card moves.
