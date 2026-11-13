---
milestone: later
concepts:
  - Posting
---

# Discussion search reads every stored post

## Current behavior

`Posting._search` matches the phrase against the content of every stored post with an unindexed, case-insensitive scan. Posts held by other features, such as assignment submissions, are read too and then dropped because no conversation places them. The reader's admission is checked once per matching discussion, so that part grows with discussions, not posts.

Local checks with 9,400 forum posts in 800 discussions and 3,000 submissions: a word in nearly every post answers in about 110 ms and 110 to 140 database commands, and a word in no post in about 10 ms. With the same posts and 30 KB submissions (about 90 MB stored), the scan alone takes 40 to 180 ms. These are local observations; the deployment's stored size and latency are unverified.

The browser waits 400 ms after typing stops and asks for at least two characters. No endpoint is rate limited, so one account can send any number of searches, and each one scans the whole collection.

## Unresolved decision

How to bound the work of one search and of one account's searches: a rate limit at the edge, a time limit on the scan, or a stored plain-text copy of forum posts with a text index, which would also let a search ignore markdown and punctuation. A limit on the number of matches is not an option before the access check, because unreadable matches would fill it and hide readable ones.

## Acceptance condition

On representative deployment resources, a common two-character search by the agreed number of simultaneous readers completes within its latency target, and repeated searches from one account cannot hold the database. Privacy tests keep covering private audiences, trashed posts and discussions, and posts no conversation places.
