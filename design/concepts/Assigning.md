# Assigning

## Purpose

Let an author draft an assignment, publish it to everyone or selected sections,
and give each assignee a release with an optional individual due date.

## Principle

Dana drafts a problem set for two sections and publishes it. Priya and Omar
each receive a release. Dana gives Omar a later due date, then clears that
override. Assigning the problem set to Omar again is refused because he already
has a release. After Dana archives the problem set, it can no longer be revised.

## Types

```types
external Author
  An application-owned identity used in the author role.

external Assignee
  An application-owned identity used in the assignee role.

external Sections
  An application-owned identity used in the sections role.
opaque Seq
  An ordered list of the values its argument names.
```

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
  an acceptsSubmissions Flag
  an audience           String
  a targets Sections
  a createdAt           Date
  an optional updatedAt Date

a set of Draft Assignments
a set of Published Assignments
a set of Archived Assignments

a set of Releases with
  an Assignment
  an assignee             Assignee
  an assignedAt           Date
  an optional dueOverride Date

Rule: an assignment's audience is either everyone or targets; when it is targets, the targets say which sections are addressed, and an assignment addressed to everyone lists none.
Rule: whether a given audience and targets agree is a calculation over the inputs alone: everyone suits an empty set of targets, targets suits a set holding at least one, and no other audience value suits a set of targets.
Rule: an assignment schedule is valid only when availableAt is on or before dueAt and an optional closeAt is on or after dueAt.
```

## Actions

```actions
createDraft(author: Author, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Flag, audience: String, targets: Sections, at: Date) : returns (assignment: Assignment)
  where audience suits targets
  then
    add a new assignment with author, title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets
    set assignment's createdAt to at
    add assignment to draft
    returns assignment
  where audience is everyone and targets is not empty
  then
    refuses ASSIGNMENT_EVERYONE_NO_TARGETS "An assignment addressed to everyone cannot list targets."
  where audience is targets and targets is empty
  then
    refuses ASSIGNMENT_TARGETS_REQUIRED "A targeted assignment needs at least one target."
  where audience is not everyone and audience is not targets
  then
    refuses ASSIGNMENT_AUDIENCE_INVALID "The assignment audience must be EVERYONE or TARGETS."
  where the assignment schedule is invalid
  then
    refuses ASSIGNMENT_SCHEDULE_INVALID "Availability must be on or before the due date, and the due date must be on or before close."

revise(assignment: Assignment, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Flag, audience: String, targets: Sections, at: Date) : returns (assignment: Assignment, status: String, audience: String, targets: Sections, acceptsSubmissions: Flag)
  where assignment in assignments, assignment not in archived, and audience suits targets
  then
    set assignment's title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets from the inputs
    set assignment's updatedAt to at
    returns assignment, status, audience, targets, acceptsSubmissions
  where assignment not in assignments
  then
    refuses ASSIGNMENT_NOT_FOUND "There is no such assignment."
  where assignment in archived
  then
    refuses ASSIGNMENT_NOT_REVISABLE "An archived assignment can no longer be revised."
  where audience is everyone and targets is not empty
  then
    refuses ASSIGNMENT_EVERYONE_NO_TARGETS "An assignment addressed to everyone cannot list targets."
  where audience is targets and targets is empty
  then
    refuses ASSIGNMENT_TARGETS_REQUIRED "A targeted assignment needs at least one target."
  where audience is not everyone and audience is not targets
  then
    refuses ASSIGNMENT_AUDIENCE_INVALID "The assignment audience must be EVERYONE or TARGETS."
  where the assignment schedule is invalid
  then
    refuses ASSIGNMENT_SCHEDULE_INVALID "Availability must be on or before the due date, and the due date must be on or before close."

publish(assignment: Assignment, at: Date) : returns (assignment: Assignment, audience: String, targets: Sections, acceptsSubmissions: Flag)
  where assignment in draft
  then
    remove assignment from draft
    add assignment to published
    set assignment's updatedAt to at
    returns assignment, audience, targets, acceptsSubmissions
  where assignment not in assignments
  then
    refuses ASSIGNMENT_NOT_FOUND "There is no such assignment."
  where assignment in assignments and assignment not in draft
  then
    refuses ASSIGNMENT_NOT_DRAFT "Only a draft can be published."
  where assignment in draft and its schedule is invalid
  then
    refuses ASSIGNMENT_SCHEDULE_INVALID "Availability must be on or before the due date, and the due date must be on or before close."

archive(assignment: Assignment, at: Date) : returns (assignment: Assignment)
  where assignment in assignments
  then
    remove assignment from draft and from published
    add assignment to archived
    set assignment's updatedAt to at
    returns assignment
  where assignment not in assignments
  then
    refuses ASSIGNMENT_NOT_FOUND "There is no such assignment."
assign(assignment: Assignment, assignee: Assignee, at: Date) : returns (release: Release)
  where assignment in published and no release has this assignment and assignee
  then
    add a new release with assignment and assignee
    set release's assignedAt to at
    returns release
  where assignment not in assignments
  then
    refuses ASSIGNMENT_NOT_FOUND "There is no such assignment."
  where assignment in assignments and assignment not in published
  then
    refuses ASSIGNMENT_NOT_PUBLISHED "Only a published assignment can be assigned."
  where a release has this assignment and assignee
  then
    refuses RELEASE_ALREADY_EXISTS "This assignee already holds a release of this assignment."

setDueOverride(assignment: Assignment, assignee: Assignee, dueAt: Date) : returns (release: Release)
  where a release has this assignment and assignee
  then
    set release's dueOverride to dueAt
    returns release
  where no release has this assignment and assignee
  then
    refuses RELEASE_NOT_FOUND "This assignee holds no release of this assignment."

clearDueOverride(assignment: Assignment, assignee: Assignee) : returns (release: Release)
  where a release has this assignment and assignee
  then
    set release's dueOverride to none
    returns release
  where no release has this assignment and assignee
  then
    refuses RELEASE_NOT_FOUND "This assignee holds no release of this assignment."
```

## Queries

```queries
_getDetail (assignment: String) : optional (detail: Assignment)
  answers the Assignment's authored fields, audience, status, and dates
  answers no row when the Assignment does not exist

_getAssignments () : many (assignment: String, author: String, title: String, instructions: String, kind: String, availableAt: String, dueAt: String, closeAt: String|null, acceptsSubmissions: Flag, audience: String, targets: Seq<String>, status: String, createdAt: Date, updatedAt: Date|null)
  answers every assignment in creation order, including drafts, published assignments, and archived assignments
  answers no rows when none match

_getAssigned (assignee: String) : many (assignment: String, release: String, dueOverride: String|null, status: String)
  answers the assignee's releases in creation order
  answers no rows when none match

_getAssignees (assignment: String) : many (assignee: String)
  answers the assignment's assignees in release order
  answers no rows when none match

_isAssigned (assignment: String, assignee: String) : one (assigned: Flag)
  answers whether the Assignee holds a release of the Assignment

_assignedAmong (assignment: String, assignees: Seq<String>) : one (assigned: Seq<String>)
  answers the supplied assignees that hold a release of the Assignment, in release order

_getPublishedForAudience (audience: String|null) : many (assignment: String)
  answers published assignments addressed to everyone or to the named section, in creation order
  answers no rows when none match

_getPublishedInWindow (start: String|Date, end: String|Date) : many (assignment: String)
  answers published assignments whose availability, due, or close date falls within the inclusive window, in creation order
  answers no rows when none match
```
