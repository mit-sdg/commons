---
milestone: public-deployment
concepts:
  - Publishing
  - Relaying
---

# Two rounds opened in the same instant both open, and the run stops reading

## Current behavior

Opening a round is guarded by a read — the run has no open round — followed
by a publish, and nothing serializes the two. Two dashboards that ask to open
two different rounds of one run in the same instant both succeed, because
Publishing refuses only a second open edition of the same material. The run
then holds two open rounds, the view that answers "the open round of the run"
matches twice where it may match once, and every read through it — the
relays list, the run, a phone's arrival — fails with `INTERNAL_ERROR` until
one round is closed by hand through the edge. A lecturer's dashboard and a
TA's dashboard tapping Open together is enough.

## Unresolved decision

Whether the guard belongs to a concept that can hold it — Linking
refusing a second open link under one run, or Publishing refusing a second
open edition under one parent — or whether the engine should offer an action
whose guard and effect are one step. The engine ask is recorded in the
workspace's blocker drain.

## Acceptance condition

Two concurrent open-round requests for two rounds of one run leave exactly
one round open and answer the other `ROUND_OPEN`, and no read of the run
fails while the race is lost.
