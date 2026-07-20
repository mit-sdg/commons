---
milestone: public-deployment
concepts:
  - Grading
---

# Give excused grades a correction path

## Current behavior

Excusing moves a grade to `EXCUSED`. Recording refuses an excused grade and
retracting accepts only a released grade, so no action returns the grade to a
draft or another standing.

## Unresolved decision

Choose whether retraction includes excused grades or whether excusing has its
own revocation action, and state what score, feedback, and release history
remain afterward.

## Acceptance condition

The specification names the chosen transition and tests confirm correction
from draft, released, and excused standings without erasing the earlier
grading history.
