# Task lists

A task list is identified by the set of profiles it is for, the way a group
message is. That set is written into one canonical name by
[computation:taskListKey](computation:taskListKey), which sorts the profiles and
drops repeats, and read back from that name by
[computation:taskListMembers](computation:taskListMembers). Because the reused
Categorizing instance already refuses a second category with an existing name,
the same people can never accumulate two lists, and no list is ever identified
by anything but the people it is for. A profile's own tasks are simply the list
whose only member is that profile, so nothing named personal exists.

[Tasks.lists.OpenList](reaction:Tasks.lists.OpenList) takes a set of profiles, ensures the
task-list member role exists, and asks the reused Categorizing instance for the
list under that set's canonical name. A list that already exists is answered
rather than replaced, which is why opening the same set twice reaches the same
list with the same tasks, and why an optional title only takes effect the first
time.

Membership is the reused Roling instance registered as `TaskListMembership`.
Every member holds the one `task-list-member` role, so every member has the same
full powers over the list's tasks and no member outranks another. That instance
shares neither role names nor grants with the course-wide Roling instance.
`OpenList` is the only place that establishes the role, because reaching any
existing list means somebody already holds it there.

[Tasks.lists.OpenedTaskListAdmitsItsMembers](reaction:Tasks.lists.OpenedTaskListAdmitsItsMembers) reads the
set back out of the list's name, keeps only the profiles that actually exist,
and grants each one membership. Because that grant is asked for rather than
demanded, opening a list restores membership to a profile in its set who had
left, and leaves the membership of everyone else untouched.

Adding a profile offers two outcomes, and the difference is which endpoint the
interface calls. [Tasks.lists.ExtendList](reaction:Tasks.lists.ExtendList) takes this list to the
larger set by renaming it, so the tasks already in it stay. The new name comes
from [computation:taskListExtension](computation:taskListExtension), which unions
the set the list is already for with the profiles named in the request, so
extending can only ever enlarge: a request that omits a current member does not
drop that member, and no membership is stranded outside the set its list is for.
Because the name is the set, a change that would give this list the set another
list already holds is refused as a duplicate name rather than merged, and the
interface can then offer to open that other list instead.
[Tasks.lists.ExtendedTaskListAdmitsItsMembers](reaction:Tasks.lists.ExtendedTaskListAdmitsItsMembers) admits
the enlarged set the same way opening does. Starting a separate list for the
larger set needs no separate endpoint: it is `OpenList` for that larger set,
which leaves the earlier list and its tasks alone.

[Tasks.lists.LeaveList](reaction:Tasks.lists.LeaveList) withdraws the acting profile's membership and
refuses when that profile does not belong to the list. The set the list is for
is its identity and does not change, so the list keeps its name, its tasks, and
its place in the interface for whoever remains.
[Tasks.lists.LeftMemberReleasesOpenTasks](reaction:Tasks.lists.LeftMemberReleasesOpenTasks) then releases
the open tasks in that list still recorded against the departing profile.
Revocation is what ends authority and personal reads; the release is a courtesy
to the remaining members, and an interrupted fan-out can leave a stale assignee
for them to release or replace.

[Tasks.lists.MyLists](reaction:Tasks.lists.MyLists) forms
[the lists a profile still belongs to](former:Tasks.lists.theTaskListsOf), and
[Tasks.lists.GetList](reaction:Tasks.lists.GetList) forms
[one list](former:Tasks.lists.theTaskList) beside the tasks that list holds, for
a member only. Both rows separate the profiles the list is for from the profiles
still in it, and count the open tasks at read time rather than storing a total.

```computations
taskListKey(members: Strings) : String
  Renders the canonical name of the task list for exactly this set of profiles.

taskListExtension(key: String, members: Strings) : String
  Renders the canonical name of the task list for that set together with these further profiles.

taskListMembers(key: String) : Strings
  Reads back the set of profiles a canonical task-list name stands for.
```

```endpoints
Tasks.lists.ExtendList at /tasklists/extend
Tasks.lists.GetList at /tasklists/get
Tasks.lists.LeaveList at /tasklists/leave
Tasks.lists.MyLists at /tasklists/mine
Tasks.lists.OpenList at /tasklists/open
```
