---
milestone: later
concepts:
  - Roling
  - Rostering
---

# Staff who don't manage the course land on refused pages

## Current behavior

A grader who holds `grade` but not `course:manage`, and has no roster seat,
signs in to a home whose course card says "You are not enrolled in this
course. Ask course staff to add you." The Course link opens `/staff`, which
needs `course:manage` and refuses them. Their grading is reachable only
through the account menu or the gradebook's tabs. The refusal pages name the
missing capability by its identifier ("Ask an administrator for a role with
course:manage."). The staff late days page needs `student-records`, so a
course manager without it is refused there too, though their dashboard links
to it.

## Unresolved decision

Decide what home and the Course link show to staff without `course:manage`
(for graders, a staff card that opens Assessments), and whether refusal pages
name the capability in words.

## Acceptance condition

Browser tests sign in as a grade-only grader and as a course manager without
`student-records`, and every link home and the navigation offer them opens a
page they can use.
