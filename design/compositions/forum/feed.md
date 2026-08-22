# Feeds and thread context

[Forum.feed.ListLatest](reaction:Forum.feed.ListLatest) uses
[the creation-ordered home feed](former:Forum.feed.theHomeFeedByCreation) to return readable root conversations
from newest to oldest creation. [Forum.feed.ListActivity](reaction:Forum.feed.ListActivity) uses
[the activity-ordered home feed](former:Forum.feed.theHomeFeedByActivity) to order those same readable roots by
their latest visible activity. Each row joins the root post with current category,
tags, lock and accepted-answer state, visible reply count, latest visible
activity, and distinct visible participants.

[Forum.feed.GetThread](reaction:Forum.feed.GetThread) returns each placed post that still has Posting,
rendering, and non-trash state, beside
[the separately formed root context](former:Forum.feed.theThreadContext). Trashing
the root omits that root and its context but does not hide intact replies.
Purging a root with children likewise leaves those replies visible; because the
root's placement is retained and its trash record is gone, root context also
remains even though the root post does not. Feed rows still omit that
conversation because they require root-post presentation.

These public reads assemble current state from its owners. Category, tag, lock,
resolution, post, or conversation changes therefore affect the next read
without rebuilding a stored feed. Optional category state can be absent within
a retained result.

```endpoints
Forum.feed.GetThread at /threads/get
Forum.feed.ListActivity at /threads/activity
Forum.feed.ListLatest at /threads/latest
```
