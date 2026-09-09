---
milestone: public-deployment
concepts:
  - Conversing
  - Posting
  - Grouping
  - Rostering
  - Notifying
  - Flagging
  - Accessing
  - Trashing
---

# Choose a discussion's audience before publishing

## Current behavior

Audiences are implemented through Accessing and audience-gated forum composition. New conversations establish a fixed complete holder set, and current collective membership determines access. There are no deployed conversations requiring backfill. Completion robustness remains tracked in [audience operation completion](../open/audience-operation-completion.md).

## Desired behavior

Accessing records explicit grants from a resource to holders. Commons
interprets each holder as an account, group, section, or standing audience.
One owner action establishes the complete initial audience atomically. Until
establishment succeeds, the conversation is unavailable. Initial notifications
and creation success follow that event.

A published conversation's explicit holders are fixed. To address different
people, a participant starts a new conversation. The ordinary New discussion action opens an empty composer; it copies no prior content or revealing link.

Person holders name fixed accounts. Group, section, and staff holders refer to
current membership: joining admits a person to history, and leaving removes
the access that holder supplies. A reader admitted by more than one holder
retains access while any of them admits the reader. Grouping keeps its existing
equal-power membership; staff address groups they belong to, not groups whose
creator would need to be recovered.

Discussion groups and shared task lists use the same membership. Group management lives in Groups, where membership controls state that adding someone admits them to earlier group discussions. Removal and departure end the grant through that group; another holder may still admit the person. The composer refreshes audience choices on return and when opening the picker, while its draft remains intact. Switching between the Staff-question and general-discussion routes initializes the corresponding audience.

Everyone means active course members plus staff. Students means active student
seats. A section admits its active members. All ordinary readers need an
authenticated, unarchived account. Course departure removes Everyone, Students,
and section access; direct person grants and continuing group membership still
admit the former member. Archival denies access through every holder.

The author has no implicit read exception. Direct messages include the sender,
and a student's question to Staff includes that student and Staff. A discussion
addressed solely to a group follows group membership for its author too.
The final explicit audience is shown before posting. Staff membership follows
the [shared capability policy](staff-classification.md).

Conversation grants remain while the conversation exists, including after root
trash or purge when replies survive. An absent conversation remains inaccessible even if audience records survive cleanup. Posting and Conversing retain their independent responsibilities.

A participant may report a readable post. Flagging keeps the concern and review outcome. Reviewing reports requires ordinary audience access. Exact-version evidence and review without conversation access are separate reporting work.

The shared feed supports All, Course-wide, and Private. Course-wide explicitly includes Everyone; Private is its complement within readable discussions. The To Staff view includes private discussions explicitly addressed to Staff, regardless of the author’s role. An inline searchable To filter matches explicit recipients. Ask staff privately is available to both students and staff. Starting a private discussion explicitly addressed to Staff notifies current staff recipients, excluding the author; mentions and explicit account addressing do not create duplicate opening notifications. Subsequent replies use ordinary participant and follower notifications. Directly addressed people also receive an initial notification. Audience membership alone does not mean following or receiving
email about every event.

Inbox content and metadata, unread counts, links, and mutations follow current
access. Private email contains no post content and is authorized again before
dispatch. Already viewed or delivered material cannot be recalled. The exact
failure and delivery contract is tracked in
[audience operation completion](../open/audience-operation-completion.md).

## Acceptance condition

The audience picker and server-side holder validation use the same addressing
policy. Ordinary read and mutation policies derive the actor from the session.
No staff or administrator role silently bypasses a conversation's audience.
Report review uses the same audience authorization.

Permanent tests cover intended readers, outsiders, anonymous callers, moderators
with and without a report, and accounts whose membership or role changes. They
exercise content, placement, author history, statistics, categories, tags, pins,
reactions, resolutions, links, revisions, subscriptions, bookmarks, notifications,
unread counts, moderation, trash, and mutation refusal behavior.

Creation failure before audience establishment keeps content closed. Withheld mail remains queued. Robust completion after interrupted or repeated operations has its own [application issue](../open/audience-operation-completion.md). An installation with zero discussions needs no audience backfill; absent grants always deny access.
