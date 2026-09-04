---
milestone: later
concepts:
  - Locking
  - Reasoning
---

# A sort tick can ask again before the last reply's placements land

## Resolution at completion

The sort endpoint takes the round's own Locking lock before it reads the
passage, so the passage is formed after the lock and the dashboards ticking
together send one ask: a tick that finds the lock held answers that nothing was
asked, and a tick that reaches the lock in the same instant stops at the
refused lock, which the wire answers as a conflict the dashboard's tick reads
as no ask of its own. Answering the ask, or failing it, gives the lock back.
The reading closed the gap from its own side too: a placement naming a card
some pile already holds is a no-op line, dropped from the lines rather than
read as a reply to stand upon, so a reply that crossed a landing placement
costs nothing.

## Decision at completion

Both options in the issue were taken, because they answer different halves.
The lock serializes the guard and the ask, which no reading can do; the no-op
line keeps a correct reply about a wall that moved under it from being stood
upon, which no lock can do — the hand moves cards while an ask is out.

## Verification at completion

Three ticks fired in one instant on one round send one ask, leave the round
locked, answer a later tick quietly, and unlock when the reply lands. Three
dashboards on one 360-card wall for ten minutes raise no insistence whose
account names a card the wall already holds and no `INTERNAL_ERROR`.
