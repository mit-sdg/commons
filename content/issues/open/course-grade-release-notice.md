---
milestone: later
concepts:
  - Notifying
  - Mailing
---

# Tell students when a course grade is released

## Current behavior

Releasing course grades changes each student's card on the Grades page and
sends nothing. Staff announce a release in the forum. Commons' notifications
are bound to forum posts, so a release has no notice of its own.

## Unresolved decision

Decide whether a release, an update of one student, and hiding each send a
notice, what it says, whether it goes by mail, inbox, or both, and whether a
held student is told anything.

## Acceptance condition

Application tests release to a class and find one notice for each released
student and the settled notice, or none, for a held student, with no notice
naming another student's grade.
