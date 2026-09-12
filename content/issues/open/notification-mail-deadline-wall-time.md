---
milestone: later
concepts:
  - Tasking
  - Rostering
---

# Mail task deadlines as course wall time, not as stored text

## Current behavior

Assignment release mail reads its due instant in the configured course timezone
and names the zone, so "Due: Fri, Sep 18, 2026, 11:59 PM EDT" reads correctly in
any inbox.

Task mail does not. Tasking stores `endsAt` as a string and task mail interpolates
that string directly, so a recipient reads the stored text rather than a wall time
in a named zone. Two notifications about the same day therefore read differently
depending on which concept raised them.

## Unresolved decision

Tasks are scoped to groups rather than to the course roster, so reading the class
timezone from Rostering to render a task deadline couples the task compositions to
the course. Whether that coupling is right, or whether Tasking should store an
instant and let the reader supply a zone, is not settled.

## Acceptance condition

Task mail and assignment mail render a deadline in the same form, and a test fixes
that form under at least one non-UTC course timezone.
