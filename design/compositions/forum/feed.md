# Feeds and thread context

[Forum.feed.ListLatest](reaction:Forum.feed.ListLatest) uses
[the creation-ordered home feed](former:Forum.feed.theHomeFeedByCreation) to return audience-authorized conversations
from newest to oldest creation. [Forum.feed.ListActivity](reaction:Forum.feed.ListActivity) uses
[the activity-ordered home feed](former:Forum.feed.theHomeFeedByActivity) to order those same conversations by
their latest structural activity. Each row joins the root post with current category,
tags, lock and accepted-answer state, visible reply count, latest visible
activity, and distinct visible participants.

[Forum.feed.GetThread](reaction:Forum.feed.GetThread) returns each placed post that still has Posting,
rendering, and non-trash state, beside
[the separately formed root context](former:Forum.feed.theThreadContext). Trashing
the root omits its content but retains structural context and intact replies.
Purging a root with children likewise leaves admitted replies readable through the thread endpoint and frontend.

These audience-authorized reads assemble current state from its owners. Category, tag, lock,
resolution, post, or conversation changes therefore affect the next read
without rebuilding a stored feed. Optional category state can be absent within
a retained result.

```endpoints
Forum.feed.GetThread at /threads/get
Forum.feed.ListActivity at /threads/activity
Forum.feed.ListLatest at /threads/latest
```

The shared Staff questions filter selects conversations explicitly addressed to Staff whose [opening author is outside Staff](view:Forum.feed.nonStaffOpening). Each reader must still have discussion access, through audience membership or administration.

```computations
staffQuestion(holders: Seq, nonStaffAuthor: Any) : Boolean
  Identifies an explicit Staff question opened by someone outside Staff.
```

Conversation context and feed inclusion require audience admission independently
of opening content. Context includes the structural outline, so unavailable
openings and intermediate posts can be shown as placeholders around surviving
readable replies. Post summaries, category, tags and opening-author classification
require a readable opening; [readableHome](view:Forum.feed.readableHome) prevents
retained category metadata appearing for unavailable content. No underlying
conversation or stored posts means no conversation context.

Thread statistics establish conversation admission, read its ordered node sequence and the corresponding post metadata, and exclude trashed or missing posts. The count, latest activity, and participants derive from this one visible sequence. Bulk queries stay inside their owners; visibility and the join remain application computations. Conversation existence is checked directly against its owned record. Admission uses the same batch of placed post metadata to require at least one stored post, independently of trash state; content reads exclude trash separately. The legacy latest/activity endpoints remain unpaged; classroom capacity is tracked in the [feed capacity issue](../../../content/issues/open/forum-feed-capacity.md).

The [paged discussion list](feed-pages.md) uses a metadata index and bounded summaries.
