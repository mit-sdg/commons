---
milestone: later
concepts:
  - Relaying
  - Categorizing
---

# Open a round on exactly the piles the screen showed picked

## Decision at completion

The open carries the picked set it was pressed with, so the person who pressed fixes what the round carries before anything runs. The server opens on that set or declines with the reason. Decided on 2026-09-23 with the new shape of [opening a round](opening-a-round-is-commissioned.md).

## Resolution at completion

Each press of Open sends `{ run, leg, picked }`. The dashboard takes the picked piles from the wall it has in hand, which counts a pile picked as soon as it is tapped, or from a fresh read of the closed source wall when it has none. The server computes the round's presentation from the request's picks and the leg's question, never from the pins on the source wall, so an Open pressed while pick writes are still in flight opens on the set the screen showed. A round that takes piles is declined `NOTHING_PICKED` when the request picks none, and `PILE_GONE` when it names a pile no longer on the source wall; the dashboard says "Pick at least one pile." or "That pile is gone." The pick control still writes each pick as its own request, and the wall still shows those pins.

## Verification at completion

`tests/app/relay-refusals.test.ts` declines a round that takes piles when the request picks none or names a pile that is gone, refuses picks that are not a list of piles before anything opens, and shows that pins on the source wall do not stand in for the request's picks. `frontend/src/components/live/run-relay-board.test.ts` checks the piles Open sends: the picked ones, and none when nothing is picked. `tests/e2e/relay-source-context.spec.ts` opens a vote and a list on the picks the request carries and reads back their choices and parts. The runoff scenario, `tests/robustness/scenarios/r2-runoff.ts`, presses Open on the dashboard after the pick control has picked the fullest piles and checks that the vote's choices are the picked piles.
