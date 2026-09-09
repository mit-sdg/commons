# Selected post controls

[Post controls](reaction:Forum.postControls.PostControls) accepts one conversation
and at most 32 bounded post identities. The session determines the reader.
Malformed selections are rejected; hidden and unknown conversations both return
NOT_FOUND. Within a readable conversation, missing, deleted, trashed, foreign and
otherwise unreadable selected posts are omitted. Duplicate identities do not
duplicate results.

[The selection](former:Forum.postControls.theSelectedPostControls) follows
Conversing's thread order and enriches only selected rows through
[the post controls](former:Forum.postControls.thePostControls). Each row contains
the reader's bookmark status, pin status, readable link counts, and
[reaction controls](former:Forum.postControls.theReactionControls): counts and
the reader's own selections, ordered by descending count with source order for
ties. Linked sources and targets retain their own readability checks. These
counts disclose neither hidden relationships nor reacting identities.

The read uses existing concept queries and stores no aggregate state. Selection
bounds enrichment, but each batch still reads the conversation's structural
thread. Existing individual endpoints and mutation authorization remain available.

The discussion page opts in through `?postControls=batched`; ordinary navigation
uses individual reads. Batched cards share one observation per 32 posts, disable
their individual control reads, and refresh their batch after a control mutation.
Missing or failed observations are unavailable, not successful empty values.

```endpoints
Forum.postControls.PostControls at /threads/post-controls
```

```computations
validPostControlSelection(posts: Seq) : Boolean
  Accepts at most 32 nonempty string identities of at most 256 characters each.
```
