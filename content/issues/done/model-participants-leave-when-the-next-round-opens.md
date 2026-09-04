---
milestone: repository-release
concepts:
  - Responding
  - Relaying
  - Subscribing
---

# Keep invited model participants in the room for the next round

## Decision at completion

An invited seat belongs to the run: when a round opens, every participant
invited earlier in the run begins a response to it, and the dashboard can
dismiss seats, one or all; a dismissed seat does not return. Decided
2026-09-02.

## Resolution at completion

A seat is the model participant subscribed to the run (`Seating`, a
Subscribing instance). Invite subscribes one seat per request, before the
first round or between rounds as readily as during one; a seat taken while a
round is open begins that round at once, and every seat begins each round
whose presentation is captured afterward. Dismiss drops one seat and Dismiss
all every seat; what a dismissed seat handed in stays. The run's read carries
its seats and each round's figure how many hand-ins were the model's, so the
dashboard counts seats, not cards.

## Verification at completion

The model-participant test seats one participant before any round, two more
on round one, reads three hand-ins on rounds one and two with no second
invitation, dismisses one seat and reads two hand-ins on round three under
the two seats that remain, dismisses all, and is refused a seat on the closed
run.
