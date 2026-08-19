# Tasking

## Purpose

Hold one piece of work together with the single stretch of time it occupies,
name at most one identity answerable for it, and say whether it is still
outstanding, finished, or called off, so a deliverable and a time-blocked duty
are read the same way and neither is lost when it is abandoned.

## Principle

Priya records "Draft the reading" running from Monday to Friday and leaves it
unassigned. Omar takes it, and retiming it to end before it begins is refused.
He completes it, sees it was the wrong one, and reopens it, so it is
outstanding again. Priya cancels it instead; it keeps its window and its
recorded assignee, and a second cancellation is refused.

## Types

```types
external Assignee
  An application-owned identity used in the assignee role.
```

## State

```state
a set of Tasks with
  a title              String
  a details            String
  a startsAt           Date
  an endsAt            Date
  an optional assignee Assignee
  a createdAt          Date
  an updatedAt         Date

an Open     set of Tasks
a Done      set of Tasks
a Canceled  set of Tasks

Rule: every task is in exactly one of open, done, and canceled.
Rule: a task's window runs from startsAt to endsAt, and endsAt is both its deadline and the end of the period it occupies.
Rule: a window is well formed when startsAt and endsAt each read as a moment and endsAt does not precede startsAt; whether a given pair is well formed is a calculation over those two inputs alone.
Rule: canceling records the state only; it neither rewrites the window nor releases the assignee.
Rule: assignees are opaque identities; Tasking neither creates nor validates them.
```

## Actions

```actions
create(title: String, details: String, startsAt: Date, endsAt: Date, assignee: Assignee, at: Date) : return (task: Task)
  where startsAt and endsAt form a well formed window
  then
    add a new task with title, details, startsAt, endsAt, and assignee
    set task's createdAt and updatedAt to at
    add task to open
    return task
  where startsAt and endsAt do not form a well formed window
  then
    refuse TASK_WINDOW_INVALID "A task's window cannot end before it begins."

retime(task: Task, startsAt: Date, endsAt: Date, at: Date) : return (task: Task)
  where task in tasks and startsAt and endsAt form a well formed window
  then
    set task's startsAt and endsAt from the inputs
    set task's updatedAt to at
    return task
  where task not in tasks
  then
    refuse TASK_NOT_FOUND "There is no such task."
  where task in tasks and startsAt and endsAt do not form a well formed window
  then
    refuse TASK_WINDOW_INVALID "A task's window cannot end before it begins."

assign(task: Task, assignee: Assignee, at: Date) : return (task: Task)
  where task in tasks and task not in canceled
  then
    set task's assignee to assignee, replacing any prior assignee
    set task's updatedAt to at
    return task
  where task not in tasks
  then
    refuse TASK_NOT_FOUND "There is no such task."
  where task in canceled
  then
    refuse TASK_CANCELED "A canceled task can no longer be changed."

release(task: Task, at: Date) : return (task: Task)
  where task in tasks and task not in canceled
  then
    set task's assignee to none
    set task's updatedAt to at
    return task
  where task not in tasks
  then
    refuse TASK_NOT_FOUND "There is no such task."
  where task in canceled
  then
    refuse TASK_CANCELED "A canceled task can no longer be changed."

complete(task: Task, at: Date) : return (task: Task)
  where task in open
  then
    remove task from open
    add task to done
    set task's updatedAt to at
    return task
  where task not in tasks
  then
    refuse TASK_NOT_FOUND "There is no such task."
  where task in done
  then
    refuse TASK_ALREADY_COMPLETE "This task is already complete."
  where task in canceled
  then
    refuse TASK_CANCELED "A canceled task can no longer be changed."

reopen(task: Task, at: Date) : return (task: Task)
  where task in done
  then
    remove task from done
    add task to open
    set task's updatedAt to at
    return task
  where task not in tasks
  then
    refuse TASK_NOT_FOUND "There is no such task."
  where task in open
  then
    refuse TASK_NOT_COMPLETE "Only a completed task can be reopened."
  where task in canceled
  then
    refuse TASK_CANCELED "A canceled task can no longer be changed."

cancel(task: Task, at: Date) : return (task: Task)
  where task in open
  then
    remove task from open
    add task to canceled
    set task's updatedAt to at
    return task
  where task not in tasks
  then
    refuse TASK_NOT_FOUND "There is no such task."
  where task in done
  then
    refuse TASK_ALREADY_COMPLETE "This task is already complete."
  where task in canceled
  then
    refuse TASK_ALREADY_CANCELED "This task is already canceled."
```

## Queries

```queries
_getTask (task: String, at: Date) : optional (title: String, details: String, startsAt: String, endsAt: String, assignee: String|Null, state: String, overdue: Boolean, createdAt: Date, updatedAt: Date)
  answers the Task's title, details, window, recorded assignee, and lifecycle state, with overdue true when the Task is open and its endsAt is earlier than at
  answers no row when the Task does not exist

_getAssigned (assignee: String, at: Date) : many (task: String, title: String, details: String, startsAt: String, endsAt: String, state: String, overdue: Boolean, createdAt: Date, updatedAt: Date)
  answers every Task whose recorded assignee is the Assignee, in creation order, each with overdue true when it is open and its endsAt is earlier than at
  answers no rows when none match
```
