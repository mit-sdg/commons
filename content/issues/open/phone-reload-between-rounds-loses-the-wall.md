---
milestone: later
concepts:
  - Responding
---

# A phone reloaded between rounds loses the wall it handed in to

## Current behavior

A phone that hands in and then reloads while the run is open but no round is
open shows no wall and reads none. The relay phone restores its response from
the device only when a round is open (the round's slot) or when the run has
closed (the last hand-in), so the closed round it just handed in to has no
wall on the reloaded screen until the next round opens. A phone that stays on
the page keeps the settled wall.

## Unresolved decision

Whether the phone between rounds should restore the last handed-in response
the way it does after the run closes, and read that wall once, or whether the
between-rounds screen should say the round has closed and wait for the next.

## Acceptance condition

A phone that handed in to a round, reloaded after that round closed and before
the next opened, shows the closed round's settled wall, reading it once, and
begins the next round when it opens.
