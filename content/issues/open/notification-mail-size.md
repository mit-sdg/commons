---
milestone: later
concepts:
  - Posting
  - Mailing
---

# Bound what a notification email may carry

## Current behavior

Forum mail carries the notified post's content whole and task mail carries the
task's details whole, so a recipient can act on the message without opening
Commons. Neither the content nor the details are bounded anywhere: Posting stores
whatever content an author submits, and the queued text and HTML both hold a full
copy.

A single very long post therefore produces a very large queued message, twice
over, and hands it to an SMTP transport that will refuse messages past its own
limit. The refusal is recorded by `markFailed` and the message stays queued, so a
pathological post can hold a permanently undeliverable message in the outbox.

## Unresolved decision

Whether to bound the post itself, bound only what mail carries, or leave both
unbounded and let delivery fail. Bounding what mail carries contradicts the
decision that a notification should be readable without opening Commons, so the
excerpt would need a visible "read the rest in Commons" ending.

## Acceptance condition

A post far larger than the transport's limit either cannot be written, or produces
a queued message that delivers, and a test fixes whichever it is.
