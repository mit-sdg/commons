---
milestone: public-deployment
concepts:
  - Assigning
  - Banking
---

# Decide how long a student may change a late day

## Current behavior

A student may apply or change late days only on a published assignment
released to them, and may cancel a standing use on any assignment. None of
the three checks the time: a student can add days after the due date, after
handing in, after grading, and after staff have released a course grade that
counted the work as late.

## Unresolved decision

Define the last moment a student may apply, change, or cancel late days on an
assignment: never, at the close date, when the work is graded, or when a
course grade counting it is released. Decide whether staff changes follow the
same cutoff.

## Acceptance condition

Application tests accept apply, change, and cancel immediately inside the
settled boundary and refuse each immediately outside it, for a student and,
if the decision says so, for staff.
