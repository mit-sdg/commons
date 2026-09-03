---
milestone: repository-release
concepts: []
---

# Let the live screens say why a change was refused

## Current behavior

The HTTP boundary answers every refusal with its category — `CONFLICT`,
`NOT_FOUND`, `INVALID_REQUEST` — never the word the concept or the
composition refused with. Every relay and wall refusal (`ROUND_OPEN`,
`SOURCE_OPEN`, `NOTHING_PICKED`, `LEG_DRAWN_ON`, `FORWARD_DRAW`, `RUN_OPEN`,
`CLOSED`, `ALREADY_SUBMITTED`) therefore reaches the dashboard, the setup
page, and the phone as "That change cannot be made right now." The generated
wire contract lists the words, so the frontend is typed for messages it can
never receive.

## Unresolved decision

Whether the boundary should pass the refusal word beside its category for the
live surfaces, so a screen can say "round one is still open" or "another round
takes from this one", or whether each screen must predict the refusal from
its own reads before sending.

## Acceptance condition

A staff member who opens a round out of order, removes a round another takes
from, or hands in twice reads a sentence that names the reason.
