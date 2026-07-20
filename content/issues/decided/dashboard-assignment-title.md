---
milestone: later
concepts:
  - Assigning
---

# Name assignments on the learner dashboard

## Current behavior

The learner dashboard displays an upcoming assignment by its identifier even
though assignment list and detail reads already carry the authored title.

## Desired behavior

The dashboard read carries and displays the assignment title. The identifier
remains the link target, not the reader-facing label.

## Acceptance condition

A frontend test shows the title for an upcoming assignment and uses its stable
identifier only in the destination URL.
