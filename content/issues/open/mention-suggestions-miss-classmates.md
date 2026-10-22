---
milestone: later
concepts:
  - Authenticating
  - Profiling
  - Rostering
---

# Suggest the people a writer means when mentioning

## Current behavior

The mention suggestions in the composer call `/users/search`, which runs
`Authenticating._search`: it matches the start of a username across every
account, sorts the matches by username, and returns the first ten. Typing a
person's name finds nobody unless the name starts their username, so "Ava"
does not suggest the account `achen` whose display name is Ava Chen. A short
prefix fills the ten slots with whatever usernames sort first, including
accounts outside the course, so the person being typed can be missing while
strangers are suggested.

## Unresolved decision

Which people a writer may mention (the course's active members, or every
account), which fields a query matches (display name words, username, or
both), how matches are ranked, and whether the list is capped or loaded whole
for a course-sized roster.

## Acceptance condition

Typing the start of any word in a course member's display name, or the start
of their username, suggests that member. Accounts outside the chosen set are
never suggested. Tests cover a name that differs from its username, a prefix
shared by more than ten accounts, and an account outside the course.
