# Tasks

A task carries one window from a start moment to an end moment, where the end is
both the deadline and the end of the period the task occupies. A task records
the list that keeps it as its scope and is assigned to at most one person, who
belongs to that list at the moment the assignment is made; a task revived after
being completed or canceled may still name someone who has since left, as the
revival paragraph below says.

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

[Tasks.tasks.UncancelTask](reaction:Tasks.tasks.UncancelTask) returns a canceled
task to open and answers that task, whose window, title, details, and recorded
assignee are exactly as cancellation left them; the list's open work therefore
counts it again from that moment. It carries Tasking's refusal through unchanged,
so a task that is already outstanding and a task that is complete are refused
distinguishably and the caller can say which.

The "must be a current member of that task's list" rule binds assignment alone.
A task revived by reopening or by uncancelling still names whoever was recorded
when it was completed or canceled, and that person may since have left the list: releasing assignments on membership loss reaches
outstanding tasks only, so a task that was not outstanding at that moment keeps
its assignee. The assignee therefore stands, on a task now outstanding again,
until a member releases or reassigns it. Uncancelling neither checks nor changes
it, exactly as reopening does not.

Assignment and the five state operations announce themselves. Assigning a task
to someone other than the acting member gives that person one unread task
notification and one email; retiming, cancelling, uncancelling, reopening, and
completing do the same for the task's recorded assignee, but only when that
assignee still belongs to the list holding the task and is not the person
acting. An unassigned task, an operation performed by the assignee, an assignee
who has left the list, and Describe, Release, Delete, and Create are all silent.
These endpoints raise those notifications themselves rather than leaving them to
a reaction, because no Tasking action carries the acting account and nothing
downstream of one could compare the actor with the person to be told. Each of
the five reads the person to tell from what Tasking now answers, since a task
recorded before the change cannot be carried across it; that widened answer is
used inside the endpoint and changes nothing a caller sees, so all eleven task
endpoints answer and refuse exactly as they did. The task notifications page
states the kinds, the email, and what a fault between a committed change and its
announcement leaves behind.

[Tasks.tasks.DeleteTask](reaction:Tasks.tasks.DeleteTask) permanently removes a
task that is already done or canceled, and answers only that the removal
happened; there is no trash, no restore, and no undo window, and once it is
acknowledged the task is absent from every later read of the list and of the
caller's assigned work. It carries Tasking's refusal through unchanged, so an
open task is refused as not yet settled, telling the caller to complete or cancel
it first. Because a task must be found before the list holding it can be
checked, a task that no longer exists is refused as forbidden: a member who
submits Delete twice is answered exactly as a non-member is, for their own
successful first removal. Tasking's own not-found refusal is therefore
unreachable through this endpoint, and no distinguishable "already removed"
answer exists for a caller to act on.

Deleting and uncancelling introduce no permission of their own: like cancelling
and completing, each is a task operation and is authorized by the same
membership policy above, so any member of the list holding the task may perform
it, and a caller who is not a member, or who names a task no readable list
holds, is refused as forbidden before Tasking is asked. The two refusals a
non-member sees are indistinguishable from each other, so membership of a list
is never revealed by them.

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
Tasks.tasks.DeleteTask at /tasks/delete
Tasks.tasks.DescribeTask at /tasks/describe
Tasks.tasks.MyTasks at /tasks/mine
Tasks.tasks.ReleaseTask at /tasks/release
Tasks.tasks.ReopenTask at /tasks/reopen
Tasks.tasks.RetimeTask at /tasks/retime
Tasks.tasks.UncancelTask at /tasks/uncancel
```
