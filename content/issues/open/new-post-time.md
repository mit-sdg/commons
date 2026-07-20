---
milestone: later
concepts:
  - Posting
  - Timing
---

# Explain the age of a new post accurately

## Current behavior

The frontend compares a post's `createdAt` value with the browser clock. A
difference under 45 seconds displays as “just now”; a larger difference is
rounded to the nearest minute, hour, day, week, month, or year.

## Unresolved decision

It is not known whether a post created through an endpoint can arrive with a
timestamp far enough from the browser clock to show an older age immediately.
If it can, the open question is whether clock skew, serialization, or rounding
causes the difference. The “just now” window remains unchanged until then.

## Acceptance condition

A deterministic test identifies the source and confirms that a genuinely new
post reads “just now” while an older occurrence keeps its accurate age.
