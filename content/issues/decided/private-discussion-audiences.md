---
milestone: public-deployment
concepts:
  - Conversing
  - Posting
  - Grouping
  - Rostering
  - Notifying
  - Flagging
  - Snapshotting
  - Trashing
---

# Choose a discussion's audience before publishing

## Current behavior

A discussion has no audience. Signed-in accounts can read forum conversations,
and the create endpoint takes only content. Students cannot choose to write
privately to staff, a classmate, or their group.

The HTTP edge already requires a valid session for forum routes in
[`src/edge.ts`](../../../src/edge.ts). The internal endpoint and former
definitions still return forum content without a reader identity. The
[`thread route tests`](../../../tests/app/thread-list-contract.test.ts) and
[`wire transcript`](../../../tests/wire/fixtures/threads.json) exercise these
different boundaries.

## Desired behavior

Accessing records explicit grants from a resource to holders. Commons
interprets each holder as an account, group, section, or standing audience.
One owner action establishes the complete initial audience atomically. Until
establishment succeeds, the conversation is unavailable. Initial notifications
and creation success follow that event.

A published conversation's explicit holders are fixed. To address different
people, a participant starts a new conversation. Continue with other people
opens an empty composer; it copies no prior content or revealing link.

Person holders name fixed accounts. Group, section, and staff holders refer to
current membership: joining admits a person to history, and leaving removes
the access that holder supplies. A reader admitted by more than one holder
retains access while any of them admits the reader. Grouping keeps its existing
equal-power membership; staff address groups they belong to, not groups whose
creator would need to be recovered.

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
trash or purge when replies survive. Final conversation removal cleans up its
audience. Posting and Conversing retain their independent responsibilities.

A participant may report a specific post. Flagging keeps the concern and review
outcome; Snapshotting preserves the selected evidence. Moderators may review
that evidence without gaining ordinary access to the conversation, neighboring
posts, or later edits. Report evidence survives resolution and source-post
purge until a separate report purge removes it. Participant-facing reads do not
disclose the reporter's identity.

The shared feed supports All, Everyone, and Private. Staff questions addressed
privately to Staff appear in a shared Staff questions view. Starting a question
does not notify every staff member; staff who participate or follow receive
ordinary participant notifications. Directly addressed people receive an initial
notification. Audience membership alone does not mean following or receiving
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
Report evidence has a separate, bounded authorization path.

Permanent tests cover intended readers, outsiders, anonymous callers, moderators
with and without a report, and accounts whose membership or role changes. They
exercise content, placement, author history, statistics, categories, tags, pins,
reactions, resolutions, links, revisions, subscriptions, bookmarks, notifications,
unread counts, moderation, trash, and mutation refusal behavior.

Creation failure, uncertain completion, report capture, mail suppression,
root removal, and migration restart follow explicit tested contracts. Migration
grants Everyone to legacy conversations without granting it to existing private
or incompletely created conversations on rerun. Browser rehearsals demonstrate
staff questions, direct messages, group history, reporting, and audience changes
through a new conversation.
