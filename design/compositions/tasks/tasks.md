# Tasks

A task carries one window from a start moment to an end moment, where the end is
both the deadline and the end of the period the task occupies. That is why a
deliverable and a time-blocked duty such as office hours need no separate shape.
A task is assigned to one profile or to none, so two people staffing one block
are two tasks.

[Tasks.tasks.CreateTask](reaction:Tasks.tasks.CreateTask) requires the acting profile to belong to
the named list, records the task unassigned, and then places it in that list, so
the list owns the task and a list's contents are read directly from the list.
The interface offers the creation moment as the start and lets the creator choose
a later one; Tasking takes both as ordinary input and refuses a window whose end
precedes its start. Because concept commits are independent, a fault between the
two steps can retain a task no list reaches; nothing else is affected.

Every following operation asks the same question through
`mayActOnTask`: which list holds this task, and does the acting profile belong to
it? A task in no list, and a task in a list the caller left, both answer the
same refusal, so authority is read from current membership rather than from
anything stored on the task.
[Tasks.tasks.RetimeTask](reaction:Tasks.tasks.RetimeTask) replaces the window,
[Tasks.tasks.AssignTask](reaction:Tasks.tasks.AssignTask) overwrites the single assignee and
additionally refuses a profile that does not belong to that task's list, and
[Tasks.tasks.ReleaseTask](reaction:Tasks.tasks.ReleaseTask) clears it, which is how an unassigned
task in a shared list is taken by any member and handed on. Every member holds
the same powers, so none of these checks looks at who created the task.

[Tasks.tasks.CompleteTask](reaction:Tasks.tasks.CompleteTask) and
[Tasks.tasks.ReopenTask](reaction:Tasks.tasks.ReopenTask) are each other's undo, so a mistaken
completion is corrected rather than living in the list forever.
[Tasks.tasks.CancelTask](reaction:Tasks.tasks.CancelTask) records the state only: a canceled task
stays readable with its original window and its recorded assignee, and canceling
a completed task stays refused, which keeps done and canceled distinct.

Reads join task, list, and membership state at the moment they are asked.
[The tasks in a list](former:Tasks.tasks.theTasksIn) orders by deadline and is
read by the list page. [Tasks.tasks.MyTasks](reaction:Tasks.tasks.MyTasks) forms
[the tasks assigned to a profile](former:Tasks.tasks.theTasksAssignedTo) across
every list, keeping only the lists that profile still belongs to, which is why a
list a profile leaves takes its tasks out of that profile's view. Both reads
carry an overdue answer decided by the current moment against the task's end
rather than by any stored flag.

```endpoints
Tasks.tasks.AssignTask at /tasks/assign
Tasks.tasks.CancelTask at /tasks/cancel
Tasks.tasks.CompleteTask at /tasks/complete
Tasks.tasks.CreateTask at /tasks/create
Tasks.tasks.MyTasks at /tasks/mine
Tasks.tasks.ReleaseTask at /tasks/release
Tasks.tasks.ReopenTask at /tasks/reopen
Tasks.tasks.RetimeTask at /tasks/retime
```
