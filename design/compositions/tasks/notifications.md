# Task notifications

The task domain keeps its own inbox. Every declaration on this page binds to
`TaskNotifying`, whose subject and link are both the concrete `TaskSubject`: the
list for a membership event, the task for a task event. No forum declaration
fires for a task notification, and nothing here fires for a forum one.

The kinds are `task-list-added` and `task-list-removed` for membership,
`task-assigned` for assignment, and `task-retimed`, `task-canceled`,
`task-uncanceled`, `task-reopened`, and `task-completed` for a change to an
assigned task. A kind says what happened; nothing reads one to decide what a
subject is.

## Membership

[Tasks.notifications.MembershipGainNotifies](reaction:Tasks.notifications.MembershipGainNotifies)
gives a person added to a task list one unread `task-list-added` notification
whose subject and link are that list. No other member is told.

[Tasks.notifications.MembershipLossNotifies](reaction:Tasks.notifications.MembershipLossNotifies)
does the same with `task-list-removed` for a person removed from a list, unless
that person removed themselves, which is silent as leaving is. Leaving triggers
neither reaction.

Both reactions are triggered by the membership change itself, not by anything it
causes, so `Tasks.lists.RemovedMemberReleasesOpenTasks` changes nothing here: a
removal produces one notification and one email however many open tasks that
release fan-out touches. A release is never a state change on this page.

The roster change is committed before either reaction runs, and a fault between
them leaves the membership changed and the announcement lost. Delivery is
at-most-once: nothing durable records who was added or removed at which instant,
so nothing re-drives a lost announcement.

## Assignment and changes to an assigned task

No Tasking action carries the acting account, so the six task endpoints raise
these notifications themselves rather than a reaction on this page doing it.

`Tasks.tasks.AssignTask` gives the named assignee one unread `task-assigned`
notification, subject and link the task, unless that assignee is the acting
account. Assigning again to the person who already holds the task notifies
again. It needs no membership test, because that endpoint already refuses an
assignee who is not a current member.

`Tasks.tasks.RetimeTask`, `Tasks.tasks.CancelTask`, `Tasks.tasks.UncancelTask`,
`Tasks.tasks.ReopenTask`, and `Tasks.tasks.CompleteTask` each give the task's
recorded assignee one unread notification under the kind for that operation,
subject and link the task, only when the task has a recorded assignee, that
assignee is still a current member of the list holding it, and that assignee is
not the acting account. Each is otherwise silent. The membership test is needed
here and not on assignment because a completed or canceled task keeps its
recorded assignee while the departure sweep releases outstanding tasks only, so
a revived task can name someone who has left.

`Tasks.tasks.DescribeTask`, `Tasks.tasks.ReleaseTask`, `Tasks.tasks.DeleteTask`,
and `Tasks.tasks.CreateTask` raise no notification.

Each of the five settles whether it will notify before it acts, and takes the
recipient from what the action answers, so the notification follows the
committed change and a retimed task announces its new deadline. None of the five
changes the assignee or the roster, so the two agree except under a concurrent
reassignment or removal, which can let one notification through for a person the
rule would refuse a moment later. That entry answers as a bare archived row and
carries no email, by the reading and email rules below.

The task state is committed before the notification is raised, and a fault
between them loses that announcement permanently. Delivery is at-most-once here
too, and a later operation raises its own notification rather than backfilling a
missed one.

## Email

[Tasks.notifications.NotificationQueuesEmail](reaction:Tasks.notifications.NotificationQueuesEmail)
follows every successful TaskNotifying action, from either raise site. It looks
up the recipient's account email, resolves the subject, and queues one Mailing
message keyed by that notification. A membership message names the list. A task
message says which change occurred and names the task title, the holding list's
title, and the current deadline as text, so it reads on its own after the task
it points at is gone.

A task message is rendered only for a recipient who is a current member of the
list holding that task, read when the message is rendered. A membership message
takes no such test: a `task-list-removed` recipient is a non-member by
construction, and naming the list is the point of it.

A notification identity is unique across both instances, so under Mailing's
one-key-one-message rule a notification never produces two emails and neither
instance can overwrite the other's queued message. The inbox entry is already
stored when this reaction runs: a missing account email, a rendering fault, a
queue refusal, or a later SMTP failure cannot retract it, and a message that
fails to send stays queued.

Two notifications queue nothing: one whose subject no longer resolves, reachable
only by settling a task and deleting it before the message is rendered, and a
task notification whose recipient has left the holding list. Neither queues a
kind-only message. In both the inbox entry stands, unread and answerable, with
no email behind it.

## Reading

[Tasks.notifications.ReadInbox](reaction:Tasks.notifications.ReadInbox) forms
[the session account's task inbox](former:Tasks.notifications.theTaskInboxOf),
enriching each entry with
[current task and list presentation](former:Tasks.notifications.theTaskNotificationPresentationOf)
where policy allows it. A body value cannot select another recipient.

Every row answers, whatever has since happened to what it points at, and always
carries its kind, subject identity, link, creation time, and read state.

Presentation is spliced only where the reader is entitled to it now. An enriched
task row carries the task's title, details, window, lifecycle state, and
recorded assignee, and the identity and title of the list holding it; its own
link stays the task. An enriched membership row carries the list's title. Roster
and task counts are in neither. All of it is joined only for lists the reader
still belongs to, and a task row only while its task still exists.

A notification whose task has been deleted answers as a bare archived row, and
task deletion runs no subject cleanup against this instance. A person removed
from a list keeps their archived rows about it, and those rows answer without
any of the content above.

A `task-list-removed` row is the one exception: it resolves the title of the
list the event was about, though its reader is no longer a member. It gains
nothing else, and every other row, including a `task-list-added` row about a
list the reader has since left, follows the membership gate.

[Tasks.notifications.UnreadCount](reaction:Tasks.notifications.UnreadCount)
returns the session account's unread count on this instance.
[Tasks.notifications.MarkRead](reaction:Tasks.notifications.MarkRead) marks one
owned entry read, [Tasks.notifications.MarkAllRead](reaction:Tasks.notifications.MarkAllRead)
marks all of that recipient's entries read, and
[Tasks.notifications.Dismiss](reaction:Tasks.notifications.Dismiss) removes one
entry owned by that recipient. TaskNotifying checks ownership, so another
account's identifier is refused as missing.

There is no `/tasknotifications/list` beside the inbox: the task inbox already
answers every row and withholds presentation where policy requires, so an
unenriched list would carry no behavior of its own.

The web notifications page and bell read both instances, merging the two lists
by creation time, summing the two unread counts into one badge, and issuing both
mark-all-read actions. The pair is not atomic: if one half fails the other still
applies and the badge stays lit until the reader retries, which is tolerable
because both halves are idempotent.

```endpoints
Tasks.notifications.Dismiss at /tasknotifications/dismiss
Tasks.notifications.MarkAllRead at /tasknotifications/markAllRead
Tasks.notifications.MarkRead at /tasknotifications/markRead
Tasks.notifications.ReadInbox at /tasknotifications/inbox
Tasks.notifications.UnreadCount at /tasknotifications/unreadCount
```
