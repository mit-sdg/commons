# Task notifications

The task domain keeps its own inbox. Every declaration on this page binds to
`TaskNotifying`, the second registered instance of Notifying, whose subject and
link are both the concrete `TaskSubject`: the list for a membership event, the
task for a task event. Because reactions, formers, and endpoints bind to a
registered instance rather than to a concept, no forum declaration fires for a
task notification and nothing here fires for a forum one; the forum inbox, its
endpoints, and its generic email keep working exactly as they do now.

This change mints exactly eight kinds, and they are the single vocabulary the
inbox join, the email rendering, and the web wording all key on:
`task-list-added` and `task-list-removed` for membership, `task-assigned` for
assignment, and `task-retimed`, `task-canceled`, `task-uncanceled`,
`task-reopened`, and `task-completed` for a change to an assigned task. Nothing
reads a kind to decide what a subject is; a kind only says what happened.

## Membership

[Tasks.notifications.MembershipGainNotifies](reaction:Tasks.notifications.MembershipGainNotifies)
gives a person added to a task list one unread `task-list-added` notification
whose subject and link are that list. No other member of the list is told, and
the member who performed the addition is never the person added, because adding
an existing member is refused.

[Tasks.notifications.MembershipLossNotifies](reaction:Tasks.notifications.MembershipLossNotifies)
gives a person removed from a task list one unread `task-list-removed`
notification whose subject and link are that list, unless the removed person is
the member who performed the removal: removing yourself is leaving by another
name, and it is silent for the same reason `Tasks.lists.LeaveList`
is silent, since the acting person already knows. Leaving never triggers this
reaction at all, because leaving is a different membership action.

Both reactions are triggered by the membership change itself rather than by
anything that change causes. `Tasks.lists.RemovedMemberReleasesOpenTasks`
therefore changes nothing here: however many open tasks that release fan-out
touches, the removal still produces exactly one notification and exactly one
email, and none of those releases raises a notification of its own. A release,
whether it comes from that fan-out or from a member releasing a task by hand, is
never a state change for the purposes of this page.

The roster change is committed and acknowledged before either reaction runs. A
fault between the two halves leaves the membership changed and the announcement
missing, permanently: delivery here is at-most-once with no retry, because
nothing durable records who was added or removed at which instant, and nothing
re-drives a lost announcement. The membership is never rolled back to match.

## Assignment and changes to an assigned task

No Tasking action carries the acting account, so nothing triggered by
`Tasking.assign`, `retime`, `cancel`, `uncancel`, `reopen`, or `complete` can
tell whether the person who acted is the person who would be told. The
comparison can only be made where the session is known, which is inside the task
endpoints themselves. `Tasks.tasks.AssignTask`, `Tasks.tasks.RetimeTask`,
`Tasks.tasks.CancelTask`, `Tasks.tasks.UncancelTask`, `Tasks.tasks.ReopenTask`,
and `Tasks.tasks.CompleteTask` each raise their own notification as part of the
behavior they already own, and this page deliberately names no separate reaction
for them: a separate one could not decide the question, and a declaration whose
stated behavior no contract can supply would be a fiction.

`Tasks.tasks.AssignTask` gives the named assignee one unread `task-assigned`
notification, subject and link the task, unless that assignee is the acting
account. Assigning again to the person who already holds the task notifies
again; nothing durable distinguishes a retry from a deliberate re-assignment,
and a duplicate entry is the safer failure. The assignee needs no membership
test of its own, because that endpoint already refuses an assignee who is not a
current member of the task's list.

Each of the other five endpoints gives the task's recorded assignee one unread
notification under the kind for that operation, subject and link the task, only
when all three of these hold: the task has a recorded assignee, that assignee is
still a current member of the list holding the task, and that assignee is not
the acting account. A task with no assignee, a task whose recorded assignee has
left the list, and an operation performed by the assignee are each silent. The
membership test is needed here and not on assignment because a completed or
canceled task keeps its recorded assignee while the departure sweep releases
outstanding tasks only, so a revived task can name someone who has left.

Each of those five endpoints settles before it acts whether it will notify at
all, and takes the recipient from what the action itself answers. The two halves
can therefore come from different moments. None of the five operations changes
the assignee or the roster, so this request cannot part them, and ordinarily the
decision matches what a read after the change would give. Another member acting
in the same instant can part them: the person notified is whoever the action
reports as the current holder, while the actor test and the membership test were
applied to whoever was read beforehand. A concurrent reassignment or removal
therefore lets one notification through for a person the rule, applied a moment
later, would have refused. Comparing the two would be a condition after the
action, which cannot be expressed, so the residue stands rather than being
argued away, and it is not the same thing as losing an announcement: at-most-once
tolerates a message that never arrives, not one the rule would have withheld.

What that residue can produce is bounded. The inbox entry is raised, and it
answers as a bare archived row, because the reading rules below already withhold
task and list presentation for a list the reader no longer belongs to. No email
follows it either, because the email reaction runs later, reads current
membership, and queues nothing for a task event whose recipient has left. A
person removed in that instant is left with one contentless row and no message.

The recipient is carried out of the completed action rather than read
beforehand, so the notification is raised only once the change is committed, and
the email content is taken from the task as the operation left it, so a retimed
task announces its new deadline. Where the action answers no assignee, there is
nobody to tell and nothing is raised.

`Tasks.tasks.DescribeTask`, `Tasks.tasks.ReleaseTask`, `Tasks.tasks.DeleteTask`,
and `Tasks.tasks.CreateTask` raise no notification.

The task state is committed and acknowledged before the notification is raised.
A fault between them leaves the change standing and the announcement lost
permanently, again at-most-once with no retry, because Tasking records only the
latest `updatedAt` and cannot identify the occurrence that would be replayed. A
later operation raises its own notification rather than backfilling a missed
one.

## Email

[Tasks.notifications.NotificationQueuesEmail](reaction:Tasks.notifications.NotificationQueuesEmail)
follows every successful TaskNotifying action, wherever the notification was
raised: the two membership reactions above and the six task endpoints alike. It
looks up the recipient's account email, resolves the entry's subject through the
group read or the task read, renders the membership message or the task message
accordingly, and queues exactly one Mailing message whose key is that
notification. A membership message names the list. A task message says which
change occurred and names the task title, the holding list's title, and the
current deadline as text, so it still reads on its own after the task it points
at is gone.

A task message is rendered only for a recipient who is a current member of the
list holding that task, read at the moment the message is rendered. That is the
same entitlement the inbox join applies, and it is what keeps a person removed
in the same instant as a task change from receiving current task and list
content for a list they have left. A membership message takes no such test: the
recipient of a `task-list-removed` message is a non-member by construction, and
naming the list is the whole point of it.

The notification identity is minted per notification and is unique across both
instances, so under Mailing's rule that one key identifies one logical message a
notification can never produce two emails, and neither notification instance can
overwrite the other's queued message. The inbox entry is already stored when
this reaction runs: a missing account email, a rendering fault, a queue refusal,
or a later SMTP failure cannot retract it, and a message that fails to send stays
queued for another attempt.

Two notifications queue no message at all. The first is one whose subject
neither read resolves by the time this reaction renders it; a task settled and
then deleted before the reaction runs is the only way to reach that, since a
group is never deleted. The second is a task notification whose recipient is no
longer a member of the holding list, which the paragraph above withholds.
Nothing is queued in either case rather than a kind-only message, because an
email that names no task and no list defeats the reason these emails carry
resolved content. In both, the reader's inbox entry stands exactly as it does
for a missing account email or a queue refusal: unread, archived, and
answerable, with no email behind it.

## Reading

[Tasks.notifications.ReadInbox](reaction:Tasks.notifications.ReadInbox) forms
[the session account's task inbox](former:Tasks.notifications.theTaskInboxOf),
enriching each entry with
[current task and list presentation](former:Tasks.notifications.theTaskNotificationPresentationOf)
where policy allows it. A body value cannot select another recipient.

Every row answers, whatever has since happened to what it points at. A row
always carries its kind, its subject identity, its link, its creation time, and
its read state, and it always keeps its link, so a link into a list the reader
has left or into a deleted task simply meets that page's ordinary answer rather
than being blanked here.

Presentation is spliced only where the reader is entitled to it now. An enriched
task row carries the task's title, details, window, lifecycle state, and
recorded assignee, and the identity and title of the list holding it, so the
client can name that list and link the row to it; a task row's own link stays
the task. An enriched membership row carries the list's title. Roster and task
counts are never part of either row. All of it is joined only for lists the
reader still belongs to, and a task row is joined only while its task still
exists.

A notification whose task has been deleted answers as a bare archived row; that
is expected rather than an error, and task deletion runs no subject cleanup
against this instance. A person removed from a list keeps their archived rows
about it, and those rows answer without any of the content above: no task title,
details, window, state, or assignee, and no holding-list title.

A `task-list-removed` row is the one exception to the membership gate: it
resolves the title of the list the event was about even though its reader is, by
construction, no longer a member. The reader was a member when it happened and
the email names the list anyway, so withholding the title there would blank the
one entry whose whole purpose is to say which list a person left. It gains
nothing else by the exception, and every other row, including a
`task-list-added` row about a list the reader has since left, follows the
membership gate above.

[Tasks.notifications.UnreadCount](reaction:Tasks.notifications.UnreadCount)
returns the session account's unread count on this instance.
[Tasks.notifications.MarkRead](reaction:Tasks.notifications.MarkRead) marks one
owned entry read, [Tasks.notifications.MarkAllRead](reaction:Tasks.notifications.MarkAllRead)
marks all of that recipient's entries read, and
[Tasks.notifications.Dismiss](reaction:Tasks.notifications.Dismiss) removes one
entry owned by that recipient. TaskNotifying checks ownership, so another
account's identifier is refused as missing, exactly as the forum instance
behaves.

This instance mirrors five of the forum's six notification endpoints and not the
sixth. There is no `/tasknotifications/list`: the forum keeps a plain retained
list beside its enriched inbox, but the task inbox already answers every row and
withholds presentation where policy requires, so a second unenriched list would
be a surface with no behavior of its own.

The web notifications page and bell read both instances. They merge the two
lists by creation time, sum the two unread counts into one badge, and issue both
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
