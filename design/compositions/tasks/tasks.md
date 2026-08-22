# Tasks

A task carries one window from a start moment to an end moment, where the end is
both the deadline and the end of the period the task occupies. A task records
the list that keeps it as its scope and is assigned to at most one member of
that list.

[Tasks.tasks.CreateTask](reaction:Tasks.tasks.CreateTask) requires the acting profile to belong to
the named list, records the task in that list scope, and sets its window. Tasking
refuses a window whose end precedes its start.

Every task operation requires the acting user to belong to the list holding that
task. Every member holds the same powers, regardless of who created the task.

[Tasks.tasks.DescribeTask](reaction:Tasks.tasks.DescribeTask) edits the title and
details of a non-canceled task.

[Tasks.tasks.RetimeTask](reaction:Tasks.tasks.RetimeTask) replaces the window of a
non-canceled task.

[Tasks.tasks.AssignTask](reaction:Tasks.tasks.AssignTask) sets the assignee and
refuses assigning to a person who is not a current member of that task's list.

[Tasks.tasks.ReleaseTask](reaction:Tasks.tasks.ReleaseTask) clears the assignee.

[Tasks.tasks.CompleteTask](reaction:Tasks.tasks.CompleteTask) marks an open task
done.

[Tasks.tasks.ReopenTask](reaction:Tasks.tasks.ReopenTask) restores a completed task
to open.

[Tasks.tasks.CancelTask](reaction:Tasks.tasks.CancelTask) cancels an open task. A
canceled task remains readable with its details, window, and recorded assignee.

Reads join task and list membership at the moment they are asked.
[The tasks in a list](former:Tasks.tasks.theTasksIn) orders tasks by deadline and
is read by the list page. [Tasks.tasks.MyTasks](reaction:Tasks.tasks.MyTasks) forms
[the tasks assigned to a profile](former:Tasks.tasks.theTasksAssignedTo) across
every list the profile still belongs to. Both reads carry an overdue status
calculated against the current instant.

```endpoints
Tasks.tasks.AssignTask at /tasks/assign
Tasks.tasks.CancelTask at /tasks/cancel
Tasks.tasks.CompleteTask at /tasks/complete
Tasks.tasks.CreateTask at /tasks/create
Tasks.tasks.DescribeTask at /tasks/describe
Tasks.tasks.MyTasks at /tasks/mine
Tasks.tasks.ReleaseTask at /tasks/release
Tasks.tasks.ReopenTask at /tasks/reopen
Tasks.tasks.RetimeTask at /tasks/retime
```
