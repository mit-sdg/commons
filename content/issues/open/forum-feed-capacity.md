---
milestone: public-deployment
concepts:
  - Accessing
  - Conversing
  - Posting
  - Trashing
---

# Keep the discussion feed responsive at classroom scale

## Current behavior

The feed builds every eligible conversation and computes reply count, latest visible activity, and participants from its visible posts. Conversation-scoped admission avoids redundant placement checks, but each request still enriches the full feed. A local burst with 100 discussions, one 201-post thread, and 200 readers takes tens of seconds and has little request-deadline headroom.

## Unresolved decision

Agree on an ordinary classroom feed latency and burst-capacity target, then decide how much feed and summary work one request should perform. Paging before expensive enrichment or another bounded read design requires a separate scoped decision. Preserve current audience membership, missing-resource denial, and visible-only statistics.

This is ordinary classroom-use capacity work, separate from [interrupted-operation recovery and withheld delivery](audience-operation-completion.md). Increasing deadlines or retrying the full feed does not bound its work; timeout does not cancel already-forwarded application work.

## Acceptance condition

On representative deployment resources, the agreed classroom burst completes within its latency target with headroom. Verification records response latency, success and error categories, query volume, and completion of work after any timeout. Privacy regressions cover outsiders, membership loss, trashed and purged openings, absent conversations, and mixed audiences. Unit tests protect read structure without machine-timing assertions.
