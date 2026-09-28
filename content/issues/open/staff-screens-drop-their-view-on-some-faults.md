---
milestone: later
concepts: []
---

# Staff screens drop their view on faults a phone rides through

## Current behavior

Two lists answer the same question, which failed requests say nothing about what was asked. A phone's poll treats ten codes that way (`outOfReach` in `frontend/src/lib/poll.ts`), among them `BAD_STATUS`, `INTERNAL_ERROR` and `UNAVAILABLE`, and keeps its screen. A staff query that retains through faults keeps its data for five (`RETAINING_CODES` in `frontend/src/hooks/use-query.ts`). So an HTML 502 or 503 from a proxy, or an `INTERNAL_ERROR`, clears the dashboard and the projector to "Something went wrong" while the phones in the same room keep their screens.

## Unresolved decision

One home for the codes that say nothing about the resource, read by both kinds of screen, and whether an `INTERNAL_ERROR` from a read belongs among them.

## Acceptance condition

An HTML 502 or 503 and an unavailable answer to the dashboard's and the projector's polls keep the held view with its stale line, as the phone keeps its own; one list decides it for both.
