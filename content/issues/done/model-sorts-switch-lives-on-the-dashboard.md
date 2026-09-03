---
milestone: later
concepts:
  - Reasoning
---

# The model sorts only while a dashboard with the switch on is open

## Resolution at completion

"Model sorts" is a fact of the run: a Pinning pin of the run in the reserved
scope `sorting`, set and cleared by two relay endpoints and carried on the
run's read as `modelSorts`. Every dashboard shows the same switch and the
projector can say the model sorts. The cadence still runs from whichever
dashboards are open, which the composition page states.

## Decision at completion

The standing consent is recorded state, read by every screen; the tick stays
on the dashboard because sorting is something a person watches.

## Verification at completion

The switch reads false on a fresh run, true after it is set, stays true when
set again, false after it is cleared, and is refused once the run has closed.
