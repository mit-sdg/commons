---
milestone: public-deployment
concepts:
  - Rostering
---

# Make dropped seats recoverable

## Current behavior

Dropping a seat removes it from the active roster. The frontend lists only
active seats, so the dropped row and the existing reinstate action become
unreachable.

## Desired behavior

Authorized staff can list dropped seats and reinstate one. Active rows show only
actions that apply to their current state.

## Acceptance condition

A browser test drops a learner, finds that learner in a dropped-seat list,
reinstates the seat, and sees the learner return to the active roster.
