---
milestone: public-deployment
concepts:
  - Accessing
  - Posting
  - Conversing
  - Notifying
  - Mailing
---

# Complete interrupted discussions and withheld delivery

## Current behavior

Discussion creation creates a post, starts its conversation, then establishes its complete audience. A failure before audience establishment leaves the discussion inaccessible. Earlier actions remain committed; an uncertain result can leave inaccessible content or a completed discussion that the caller did not receive. Repeating the request may create a duplicate. Replies and deletion retain the baseline completion behavior. Occurrence logs do not survive restart; see [durable occurrence logs](durable-occurrence-logs.md).

A reproduced non-crashing case is a caller deadline expiring while creation continues. The discussion completes after the caller stops waiting; retrying creates another completed discussion. A deadline does not cancel the forwarded operation, and no request identity currently connects the retry to that earlier completion.

Forum notification recipients are checked against the current audience before enqueueing and before mail dispatch. Forum mail contains no post content. If the recipient loses access, the worker withholds the message and leaves it queued without marking it sent or treating it as an SMTP failure. It may become eligible on a later pass. Mailing has no cancellation outcome. Dispatch that has already begun cannot be recalled.

Another reproduced non-crashing case is SMTP accepting a message before Mailing's `markSent` database write fails. The message remains pending, so a later worker pass can send it again. Transport acceptance and recording completion are separate steps; the current message identity does not guarantee recipient-side deduplication.

## Unresolved decision

Design repeated-request handling, interruption recovery, deletion recovery, and delivery outcomes together in a separate robustness pass. Decide whether an ineligible queued message should be cancelled permanently or remain eligible for later delivery. Keep eligibility policy in application composition and delivery integration.

Exact-version report evidence, review without conversation access, individual report resolution, and independent report purge are a separate reporting project. Ordinary reports currently require the reviewer to belong to the source conversation’s audience.

## Acceptance condition

Failure and repeated-request tests demonstrate the chosen completion behavior without weakening audience isolation. Delivery tests distinguish withholding, dispatch, transport failure, and cancellation, and verify that ineligible messages are never marked delivered.
