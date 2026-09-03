---
milestone: later
concepts:
  - Reasoning
---

# The model sorts only while a dashboard with the switch on is open

## Current behavior

Sorting by the model runs on a cadence: the dashboard asks the sort endpoint
every three seconds while its "Model sorts" switch is on, and the endpoint asks
the reasoner only when a card is in the tray and nothing about the round is
pending. The switch is held by the dashboard page, not by any concept, so two
staff dashboards on one run may disagree, the projector never sorts, and a run
with no dashboard open is not sorted at all.

## Unresolved decision

Whether "the model sorts this run" is state a concept should own — a standing
consent a reaction reads, so the floor's worker can tick without a browser —
or whether the dashboard's cadence is the right home because sorting is
something a person watches.

## Acceptance condition

Either a run's sorting standing is one recorded fact every dashboard and the
projector read, or the composition page states that sorting rides the open
dashboard and the projector says so when none is open.
