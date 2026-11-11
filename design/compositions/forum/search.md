# Searching discussions

[Forum.search.SearchDiscussions](reaction:Forum.search.SearchDiscussions) finds
the posts whose text contains a phrase and answers each one beside the
conversation holding it. Posting matches the phrase literally and ignores
letter case; the opening post's title is part of its text, so titles and
bodies are searched alike, and so are replies.

Every match passes through
[readableSearchHit](view:Forum.search.readableSearchHit) before it is formed
into [the reader's matches](former:Forum.search.theSearchHitsOf). That view
requires the post to be placed in a conversation, so posts used by other
features never surface, and applies the same post readability as every other
forum read: the reader must belong to the conversation's current audience, the
conversation must not be in the trash, and the post itself must not be in the
trash. A search therefore never reveals a private discussion, a trashed post,
or the existence of either.

The phrase must hold something besides whitespace and be at most 200
characters; anything else is refused with `INVALID_REQUEST` before Posting is
asked. The browser orders the matching conversations by the discussion list's
own order and applies its filters to them.

```endpoints
Forum.search.SearchDiscussions at /discussions/search
```

```computations
validSearchText(text: String) : Boolean
  Accepts a phrase of at most 200 characters that is not only whitespace.
```
