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
  an acceptsSubmissions Bool
  an audience           String
  a targets Sections
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

Rule: an assignment's audience is either everyone or targets; when it is targets, the targets say which sections are addressed, and an assignment addressed to everyone lists none.
Rule: whether a given audience and targets agree is a calculation over the inputs alone: everyone suits an empty set of targets, targets suits a set holding at least one, and no other audience value suits a set of targets.
```

## Actions

```actions
createDraft(author: Author, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: Sections, at: Date) : return (assignment: Assignment)
  where audience suits targets
  then
    add a new assignment with author, title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets
    set assignment's createdAt to at
    add assignment to draft
    return assignment
  where audience is everyone and targets is not empty
  then
    refuse ASSIGNMENT_EVERYONE_NO_TARGETS "An assignment addressed to everyone cannot list targets."
  where audience is targets and targets is empty
  then
    refuse ASSIGNMENT_TARGETS_REQUIRED "A targeted assignment needs at least one target."
  where audience is not everyone and audience is not targets
  then
    refuse ASSIGNMENT_AUDIENCE_INVALID "The assignment audience must be EVERYONE or TARGETS."

revise(assignment: Assignment, title: String, instructions: String, kind: String, availableAt: Date, dueAt: Date, closeAt: Date, acceptsSubmissions: Bool, audience: String, targets: Sections, at: Date) : return (assignment: Assignment, status: String, audience: String, targets: Sections, acceptsSubmissions: Bool)
  where assignment in assignments, assignment not in archived, and audience suits targets
  then
    set assignment's title, instructions, kind, availableAt, dueAt, closeAt, acceptsSubmissions, audience, and targets from the inputs
    set assignment's updatedAt to at
    return assignment, status, audience, targets, acceptsSubmissions
  where assignment not in assignments
  then
    refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."
  where assignment in archived
  then
    refuse ASSIGNMENT_NOT_REVISABLE "An archived assignment can no longer be revised."
  where audience is everyone and targets is not empty
  then
    refuse ASSIGNMENT_EVERYONE_NO_TARGETS "An assignment addressed to everyone cannot list targets."
  where audience is targets and targets is empty
  then
    refuse ASSIGNMENT_TARGETS_REQUIRED "A targeted assignment needs at least one target."
  where audience is not everyone and audience is not targets
  then
    refuse ASSIGNMENT_AUDIENCE_INVALID "The assignment audience must be EVERYONE or TARGETS."

publish(assignment: Assignment, at: Date) : return (assignment: Assignment, audience: String, targets: Sections, acceptsSubmissions: Bool)
  where assignment in draft
  then
    remove assignment from draft
    add assignment to published
    set assignment's updatedAt to at
    return assignment, audience, targets, acceptsSubmissions
  where assignment not in assignments
  then
    refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."
  where assignment in assignments and assignment not in draft
  then
    refuse ASSIGNMENT_NOT_DRAFT "Only a draft can be published."

archive(assignment: Assignment, at: Date) : return (assignment: Assignment)
  where assignment in assignments
  then
    remove assignment from draft and from published
    add assignment to archived
    set assignment's updatedAt to at
    return assignment
  where assignment not in assignments
  then
    refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."
assign(assignment: Assignment, assignee: Assignee, at: Date) : return (release: Release)
  where assignment in published and no release has this assignment and assignee
  then
    add a new release with assignment and assignee
    set release's assignedAt to at
    return release
  where assignment not in assignments
  then
    refuse ASSIGNMENT_NOT_FOUND "There is no such assignment."
  where assignment in assignments and assignment not in published
  then
    refuse ASSIGNMENT_NOT_PUBLISHED "Only a published assignment can be assigned."
  where a release has this assignment and assignee
  then
    refuse RELEASE_ALREADY_EXISTS "This assignee already holds a release of this assignment."

setDueOverride(assignment: Assignment, assignee: Assignee, dueAt: Date) : return (release: Release)
  where a release has this assignment and assignee
  then
    set release's dueOverride to dueAt
    return release
  where no release has this assignment and assignee
  then
    refuse RELEASE_NOT_FOUND "This assignee holds no release of this assignment."

clearDueOverride(assignment: Assignment, assignee: Assignee) : return (release: Release)
  where a release has this assignment and assignee
  then
    set release's dueOverride to none
    return release
  where no release has this assignment and assignee
  then
    refuse RELEASE_NOT_FOUND "This assignee holds no release of this assignment."
```

## Queries

```queries
_getDetail (assignment: String) : optional (detail: Assignment)
  answers the Assignment's authored fields, audience, status, and dates
  answers no row when the Assignment does not exist

_getAssignments () : many (assignment: String, author: String, title: String, instructions: String, kind: String, availableAt: String, dueAt: String, closeAt: String|Null, acceptsSubmissions: Boolean, audience: Audience, targets: Strings, status: String, createdAt: Date, updatedAt: Date|Null)
  answers every assignment in creation order, including drafts, published assignments, and archived assignments
  answers no rows when none match

_getAssigned (assignee: String) : many (assignment: String, release: String, dueOverride: String|Null, status: ASSIGNED)
  answers the assignee's releases in creation order
  answers no rows when none match

_getAssignees (assignment: String) : many (assignee: String)
  answers the assignment's assignees in release order
  answers no rows when none match

_isAssigned (assignment: String, assignee: String) : one (assigned: Boolean)
  answers whether the Assignee holds a release of the Assignment

_getPublishedForAudience (audience: String|Null) : many (assignment: String)
  answers published assignments addressed to everyone or to the named section, in creation order
  answers no rows when none match

_getPublishedInWindow (start: String|Date, end: String|Date) : many (assignment: String)
  answers published assignments whose availability or due date falls within the inclusive window, in creation order
  answers no rows when none match
```
