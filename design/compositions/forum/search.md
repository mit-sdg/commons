# Searching discussions

[Forum.search.SearchDiscussions](reaction:Forum.search.SearchDiscussions) finds
the discussions holding a post whose text contains a phrase, and answers each
discussion once beside its newest matching post. Posting matches the phrase
literally and ignores letter case; the opening post's title is part of its
text, so titles and bodies are searched alike, and so are replies.

[readableSearchHit](view:Forum.search.readableSearchHit) keeps the matches
the reader may read before they are formed into
[the reader's matches](former:Forum.search.theSearchHitsOf). It sets aside
trashed posts, keeps only posts placed in a conversation, so posts used by
other features never surface, and then admits each discussion through the
same audience rule as every other forum read: the reader must belong to the
discussion's current audience, and the discussion must not be in the trash. A
search therefore never reveals a private discussion, a trashed post, or the
existence of either.

The reader's admission is checked once per discussion rather than once per
matching post, so a phrase that appears in thousands of posts costs no more
than the discussions holding them. Nothing is cut off: every readable
discussion holding a live match is answered.

The phrase must hold at least two characters besides surrounding whitespace,
be at most 200 characters, and be well-formed text without a null character;
anything else is refused with `INVALID_REQUEST` before Posting is asked. The
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
