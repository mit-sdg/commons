---
milestone: public-deployment
concepts:
  - Assigning
  - Submitting
---

# Validate assignments before accepting submissions

## Current behavior

An active learner can submit work under any assignment string. Commons does
not check that the assignment exists, is published, was released to that
learner, accepts submissions, is available yet, or remains open.

## Unresolved decision

Define when a learner may submit, including whether a late-day use extends the
close time and which recorded assignment time controls an attempt already in
progress.

## Acceptance condition

Application tests refuse unknown and draft assignments, assignments not
released to the learner, assignments that reject submissions, early attempts,
and attempts after the settled close boundary. A released, available, open
assignment accepts the submission.
