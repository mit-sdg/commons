---
milestone: public-deployment
concepts:
  - Grading
  - Submitting
---

# Correct grades when learners have several attempts

## Current behavior

The staff assignment page renders one grade editor per submission attempt even
though Grading keeps one grade per learner and item. Editing state is keyed by
learner, so several editors open together. A released grade must be retracted
before revision, but the page offers no retraction path.

## Unresolved decision

Decide how evidence from several attempts relates to the learner's one grade
and where staff choose the evidence used for a correction.

## Acceptance condition

The page presents one unambiguous grade workflow per learner, identifies the
chosen evidence, and lets authorized staff correct a released grade through the
settled lifecycle without duplicate editors.
