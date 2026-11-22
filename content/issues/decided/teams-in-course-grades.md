---
milestone: later
concepts:
  - Assigning
  - Submitting
  - Grading
  - Delegating
  - Rostering
---

# Submit and grade team work by team

## Current behavior

A team is a section: staff make it, place students in it, and move them. An
assignment records whether each student or each section submits it, and staff
may change that after publication. On an assignment submitted by each section,
the section is the submitter. Any member submits, every member reads the same
attempts with who handed each in, one assessment is recorded and released for
the section, grading is delegated per section, late days are refused, a due
override covers the section, and course grades count the section's work for
each current member. A student in no section submits and is graded alone. A
student moved to another section reads that section's work. One route moves
attempts and assessments made before the change to the sections, as drafts.

The web pages do not show any of this yet. The assignment form has no choice of
submitter, the student pages do not name a section's members or who submitted,
the staff assignment page lists students and not sections, the move has no
button, and a section is still labelled Section. Releasing an assessment sends
no notice, to a student or to a section's members.

## Desired behavior

The interface says Team wherever a section is shown. The assignment form
offers the choice of submitter. A student's assignment page and home list show
the team's attempts, who submitted each and when, and the team's members, with
no late-day control. The staff assignment page lists one row per team with its
members named, sets a due override on a team's row, offers the move while any
member's own attempt has not been moved, reports how many submissions it moved
to how many teams, and flags a team whose two copied grades differ. A member
who did less than their share is corrected with a course-grade override that
names its reason.

## Acceptance condition

Application tests form a team, submit one team deliverable, grade and release
it once, and read the same rating on each member's assignment and course
grade. Browser tests cover the form's choice, a teammate reading a submitted
team attempt, a grader grading a team's row, and the move with its report.
