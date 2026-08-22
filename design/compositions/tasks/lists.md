# Task lists

A task list has an independent identity owned by the reused `Grouping` instance.
Every list has a mutable title and a non-empty roster of members. Every current
member has equal power: any member can rename the list, add a new member, remove
another member, or leave the list.

[Tasks.lists.CreateList](reaction:Tasks.lists.CreateList) creates a new group with the
given title and adds the authenticated creator as its first member. A newly
created list is a distinct list even if another list shares the same title or
members.

[Tasks.lists.RenameList](reaction:Tasks.lists.RenameList) allows any current member
to rename the list. Titles need not be unique.

[Tasks.lists.AddMember](reaction:Tasks.lists.AddMember) allows any current member to
add an existing person to the list. Adding a person who is already a member is
refused.

[Tasks.lists.RemoveMember](reaction:Tasks.lists.RemoveMember) allows any current
member to remove another member. Removing the final remaining member is refused
so a durable list cannot become inaccessible.

[Tasks.lists.LeaveList](reaction:Tasks.lists.LeaveList) withdraws the acting
member's membership. Leaving as the final member is refused.

[Tasks.lists.LeftMemberReleasesOpenTasks](reaction:Tasks.lists.LeftMemberReleasesOpenTasks)
and [Tasks.lists.RemovedMemberReleasesOpenTasks](reaction:Tasks.lists.RemovedMemberReleasesOpenTasks)
linearize membership loss: when a member leaves or is removed, open tasks in that
list assigned to that person are immediately released, while completed and
canceled tasks retain their recorded history.

[Tasks.lists.MyLists](reaction:Tasks.lists.MyLists) forms
[the lists a profile belongs to](former:Tasks.lists.theTaskListsOf), and
[Tasks.lists.GetList](reaction:Tasks.lists.GetList) forms
[one list](former:Tasks.lists.theTaskList) beside the tasks that list holds, for
a current member only.

```endpoints
Tasks.lists.AddMember at /tasklists/add-member
Tasks.lists.CreateList at /tasklists/create
Tasks.lists.GetList at /tasklists/get
Tasks.lists.LeaveList at /tasklists/leave
Tasks.lists.MyLists at /tasklists/mine
Tasks.lists.RemoveMember at /tasklists/remove-member
Tasks.lists.RenameList at /tasklists/rename
```
