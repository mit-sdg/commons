---
milestone: public-deployment
concepts:
  - Publishing
  - Relaying
---

# Two rounds opened in the same instant both open, and the run stops reading

## Resolution at completion

Opening a round takes a Locking lock on the run before it publishes, and a
round's close gives it back on every path. Two requests in one instant both
reach the lock; one holds it and publishes, the other's request stops at the
refused lock, which the boundary answers as a conflict and the dashboard
reads as `ROUND_OPEN` from the run as it then stands. Locking's floor refuses
a second lock on a duplicate key rather than reading before it inserts, so
the rule holds under concurrency for every lock in the application.

## Decision at completion

The guard belongs to a concept that serializes it: Locking, whose rule is one
lock per target, is the run's "a round is open". The read guard on the
open-round endpoint stays, for the refusal sentences.

## Verification at completion

Twenty-five trials of three concurrent open-round requests on one run each
leave one round open, two conflicts, and a run that reads; the lock is
released by closing the round and by closing the run. Twenty concurrent locks
on one target leave one holder.
