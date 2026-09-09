# Paged discussion list

[The feed index](reaction:Forum.feedPages.Index) returns only authorized conversation
identities, explicit audience labels, and the Staff-question flag through
[shared metadata](former:Forum.feedPages.theFeedEntry). The
[creation index](former:Forum.feedPages.theCreationIndex) and
[activity index](former:Forum.feedPages.theActivityIndex) preserve Conversing's source order. Activity order includes
structural node timestamps; the displayed activity statistic excludes unavailable
posts. The index reads placed-post metadata for admission and opening authors,
without loading bodies, tags, locks, or resolutions. The
[metadata opening author](view:Forum.feedPages.nonStaffMetadataOpening) classifies Staff questions using the same role policy as full reads.

The browser derives recipient choices from the whole authorized index, applies
its audience and exact-recipient filters, and selects 25 identities at a time.
[Selected summaries](reaction:Forum.feedPages.Summaries) recheck current access
before returning opening title/excerpt and the usual row details. Missing or
newly inaccessible identities are omitted. The summary request rejects malformed
identities or more than 25 selections before reading conversations. Only selected
rows reach the [selected summary collection](former:Forum.feedPages.theSelectedSummaries)'s
[nested enrichment](former:Forum.feedPages.theSelectedSummary). Its
[opening preview](former:Forum.feedPages.theOpeningPreview) contains title and excerpt without the full body. Existing concepts and their policies are unchanged.

This bounds content enrichment, not the metadata scan. Each summary request still
lists Conversing's candidates. The browser retains its index during Load more;
new discussions and changes in order appear on the next index refresh. A revoked
selection can leave a short page. Previously delivered content is not retractable.

```endpoints
Forum.feedPages.Index at /threads/index
Forum.feedPages.Summaries at /threads/summaries
```

```computations
validFeedOrder(order: String) : Boolean
  Accepts creation or activity ordering.
validThreadSelection(conversations: Seq) : Boolean
  Accepts at most 25 nonempty bounded string identities.
metadataOpeningAuthor(item: String, posts: Seq) : Any
  Finds the opening author among stored post metadata.
postPreview(content: String) : Record
  Extracts the opening title and body excerpt using shared presentation rules.
```
