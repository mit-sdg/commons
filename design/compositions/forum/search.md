# Searching discussions

[Forum.search.SearchDiscussions](reaction:Forum.search.SearchDiscussions) finds
the discussions holding a post whose text contains a phrase, and answers each
discussion once beside its newest matching post. Posting matches the phrase
literally and ignores letter case; the opening post's title is part of its
text, so titles and bodies are searched alike, and so are replies.

Every match passes through
[readableSearchHit](view:Forum.search.readableSearchHit) before it is formed
into [the reader's matches](former:Forum.search.theSearchHitsOf). Trashed
posts are set aside, and only posts placed in a conversation remain, so posts
used by other features never surface. Each remaining discussion is then
checked with the same audience rule as every other forum read: the reader
must belong to the discussion's current audience, and the discussion must not
be in the trash. A search therefore never reveals a private discussion, a
trashed post, or the existence of either.

The reader's admission is checked once per discussion, not once per matching
post. `Posting._search` still reads every stored post on each search.
Nothing is cut off: every readable discussion holding a live match is
answered.

The phrase must hold at least two characters besides surrounding whitespace,
be at most 200 characters, and be well-formed text without a null character;
anything else is refused with `INVALID_REQUEST` before `Posting._search` runs. The
browser orders the matching discussions by the discussion list's own order
and applies its filters to them.

```endpoints
Forum.search.SearchDiscussions at /discussions/search
```

```computations
validSearchText(text: String) : Boolean
  Accepts well-formed text of at most 200 characters, without a null character, holding at least two characters besides surrounding whitespace.

withoutTrashed(items: Seq<String>, trashed: Seq<String>) : Seq<String>
  Keeps the items, in order, that are not among the trashed ones.
```
