---
milestone: later
concepts:
  - Relaying
  - Categorizing
---

# Open follows the screen's picked set before the server has written it

## Current behavior

The dashboard's pick control writes one request per pile when the picked
set changes (a tap on a bar, or Top over a wall). The Open button's label and
its readiness are drawn from the screen's own picked set as soon as the tap
lands, while those writes are still in flight. An Open pressed in that window
opens the next round on whatever the server has acknowledged so far: the
runoff scenario (`tests/robustness/scenarios/r2-runoff.ts`) once opened a
vote on one choice where the screen showed two picked, and on its rerun on
two. Seen once on a quiet stack under the 2026-09-15 repair pass sweep
(`evaluation/live-performance/repair/scenarios/repair-r2/` in the design
workspace); the same window was seen earlier as a read of the picked set
catching the control mid-write.

## Unresolved decision

Whether Open should wait for the picked set's writes to be acknowledged (the
button out until the last pick request answers, or until a read of the wall
agrees with the screen), or whether the open should carry the picked set it
was pressed with, so the server opens on that set or refuses.

## Acceptance condition

An Open pressed at any moment after a change to the picked set opens the
next round on exactly the set the screen showed when it was pressed, or
refuses with the reason; the runoff scenario passes on every run.
