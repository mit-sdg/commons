---
milestone: public-deployment
concepts:
  - Banking
---

# Show a learner's applied late days

## Current behavior

The balance reflects a late-day use, but assignment detail does not load that
use. It begins from zero and offers another Apply action instead of the current
use's change and cancel paths.

## Desired behavior

Assignment detail reads the learner's standing use and presents its days,
status, change action, and cancel action alongside the balance.

## Acceptance condition

A browser test applies, changes, cancels, and reapplies late days and sees the
matching standing use and balance after each transition and reload.
