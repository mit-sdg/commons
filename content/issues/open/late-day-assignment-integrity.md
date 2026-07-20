---
milestone: public-deployment
concepts:
  - Assigning
  - Banking
---

# Validate assignments before applying late days

## Current behavior

An active learner can apply late days to any item identifier. Commons does not
check that it names an assignment that exists, was released to that learner, is
in a state where its deadline can change, or is still within the time when late
days may be applied.

## Unresolved decision

Define which released assignments accept late days, the first and last moment
when a learner may apply them, and what happens when the assignment is later
archived or withdrawn.

## Acceptance condition

Application tests refuse unknown and unreleased assignments, every excluded
assignment state, and times immediately outside each settled boundary. They
accept a released assignment in every allowed state and time window.
