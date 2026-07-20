# Assigning

## Purpose

Let an author draft an assignment, publish it to everyone or selected sections,
and give each assignee a release with an optional individual due date.

## Principle

Dana drafts a problem set for two sections and publishes it. Priya and Omar
each receive a release. Dana gives Omar a later due date, then clears that
override. Assigning the problem set to Omar again is refused because he already
has a release. After Dana archives the problem set, it can no longer be revised.

## State

```state
a set of Assignments with
  an author             Author
  a title               String
  an instructions       String
  a kind                String
  an availableAt        Date
  a dueAt               Date
  an optional closeAt   Date
  an acceptsSubmissions Bool
  an audience           String
  a targets set of Sections
  a createdAt           Date
  an optional updatedAt Date

a Draft     set of Assignments
a Published set of Assignments
an Archived set of Assignments

a set of Releases with
  an Assignment
  an assignee             Assignee
  an assignedAt           Date
  an optional dueOverride Date
```

An assignment's audience is either everyone or targets; when it is targets, the targets say which sections are addressed, and an assignment addressed to everyone lists none. Whether a given audience and targets agree is a calculation over the inputs alone:

```computation
(audience: String) suits (targets: set of Sections) : Bool
```

Everyone suits an empty set of targets; targets suits a set holding at least one.
No other audience value suits a set of targets.

## Actions

```actions
createDraft (author: Author, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: set of Sections, at: Date) : return (assignment: Assignment), refuse (message: String)
  where audience suits targets
  then
    add a new assignment with author, title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets
    set assignment's createdAt to at
    add assignment to draft
    return assignment
  where audience is everyone and targets is not empty
  then
    refuse "An assignment addressed to everyone cannot list targets."
  where audience is targets and targets is empty
  then
    refuse "A targeted assignment needs at least one target."
  where audience is not everyone and audience is not targets
  then
    refuse "The assignment audience must be EVERYONE or TARGETS."

revise (assignment: Assignment, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: set of Sections, at: Date) : return (assignment: Assignment, status: String, audience: String, targets: set of Sections, acceptsSubmissions: Bool), refuse (message: String)
  where assignment in assignments, assignment not in archived, and audience suits targets
  then
    set assignment's title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets from the inputs
    set assignment's updatedAt to at
    return assignment, its status, audience, targets, and acceptsSubmissions
  where assignment not in assignments
  then
    refuse "There is no such assignment."
  where assignment in archived
  then
    refuse "An archived assignment can no longer be revised."
  where audience is everyone and targets is not empty
  then
    refuse "An assignment addressed to everyone cannot list targets."
  where audience is targets and targets is empty
  then
    refuse "A targeted assignment needs at least one target."
  where audience is not everyone and audience is not targets
  then
    refuse "The assignment audience must be EVERYONE or TARGETS."

publish (assignment: Assignment, at: Date) : return (assignment: Assignment, audience: String, targets: set of Sections, acceptsSubmissions: Bool), refuse (message: String)
  where assignment in draft
  then
    remove assignment from draft
    add assignment to published
    set assignment's updatedAt to at
    return assignment, its audience, targets, and acceptsSubmissions
  where assignment not in assignments
  then
    refuse "There is no such assignment."
  where assignment in assignments and assignment not in draft
  then
    refuse "Only a draft can be published."

archive (assignment: Assignment, at: Date) : return (), refuse (message: String)
  where assignment in assignments
  then
    remove assignment from draft and from published
    add assignment to archived
    set assignment's updatedAt to at
    return
  where assignment not in assignments
  then
    refuse "There is no such assignment."

assign (assignment: Assignment, assignee: Assignee, at: Date) : return (release: Release), refuse (message: String)
  where assignment in published and no release has this assignment and assignee
  then
    add a new release with assignment and assignee
    set release's assignedAt to at
    return release
  where assignment not in assignments
  then
    refuse "There is no such assignment."
  where assignment in assignments and assignment not in published
  then
    refuse "Only a published assignment can be assigned."
  where a release has this assignment and assignee
  then
    refuse "This assignee already holds a release of this assignment."

setDueOverride (assignment: Assignment, assignee: Assignee, dueAt: Date) : return (release: Release), refuse (message: String)
  where a release has this assignment and assignee
  then
    set release's dueOverride to dueAt
    return release
  where no release has this assignment and assignee
  then
    refuse "This assignee holds no release of this assignment."

clearDueOverride (assignment: Assignment, assignee: Assignee) : return (release: Release), refuse (message: String)
  where a release has this assignment and assignee
  then
    set release's dueOverride to none
    return release
  where no release has this assignment and assignee
  then
    refuse "This assignee holds no release of this assignment."
```

## Questions

- `_getDetail (assignment)` answers at most one row containing the assignment's
  authored fields, audience, status, and dates.
- `_getAssignments ()` answers every assignment in creation order, including
  drafts, published assignments, and archived assignments.
- `_getAssigned (assignee)` answers the assignee's releases in creation order.
- `_getAssignees (assignment)` answers the assignment's assignees in release
  order.
- `_isAssigned (assignment, assignee)` answers exactly one row with `assigned`.
- `_getPublishedForAudience (audience)` answers published assignments addressed
  to everyone or to the named section, in creation order.
- `_getPublishedInWindow (start, end)` answers published assignments whose
  availability or due date falls within the inclusive window, in creation
  order.
