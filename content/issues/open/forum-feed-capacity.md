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

The feed builds every eligible conversation. Admission and statistics share a batch of placed post metadata, while visibility is derived from current audience membership, owned conversation existence, stored posts, and trash state. Conversation listing groups its nodes in one pass. The feed remains unpaged and each reader still forms every eligible row.

Local checks with 50 simultaneous readers, 100 discussions, and 300 posts complete in about 2.6–2.7 seconds when every discussion is addressed to Everyone, and 1.7–1.8 seconds with mixed audiences. Fifty readers plus ten private submissions complete without timeouts in both datasets. These are local observations; representative deployment capacity remains unverified.

A local production-build HTTP rehearsal also included the homepage document, session and permission reads, course/dashboard reads, notification counts, and the profiles requested after the feed. For 50 simultaneous clients, feed data arrived about 3.9 seconds after navigation with mixed audiences and 4.7–4.8 seconds with Everyone-heavy discussions. Completing the data requests took roughly 11.4 and 13.8–13.9 seconds at p95 respectively. Individual profile loading produced 2,100–2,500 additional requests. Concurrent private submissions completed in roughly 2.5–2.6 seconds, with exactly ten creations and outsider denial. One repeated mixed workload returned a profile network error whose origin remains unclassified; the subsequent Everyone workloads completed without transport errors. These are local HTTP-client observations, not measurements on deployment hardware or fifty rendered browser pages.

The profile provider already fetched identities individually before Audiences. Profiling has an existing batch query, but the HTTP and frontend read path does not use it. A batch profile surface must preserve member, self, and course-manager field visibility and the account-scoped presentation cache. No authorization bypass or additional stored identity is needed to investigate this bottleneck.

## Unresolved decision

The classroom workload is 50 simultaneous student readers. Confirm the latency on deployment resources; roughly two-second p95 is the proposed target, with headroom for concurrent submissions. If full-feed formation remains too expensive, decide how much feed and summary work one request should perform. Paging before expensive enrichment or another bounded read design requires a separate scoped decision. Preserve current audience membership, missing-resource denial, and visible-only statistics.

This is ordinary classroom-use capacity work, separate from [interrupted-operation recovery and withheld delivery](audience-operation-completion.md). Increasing deadlines or retrying the full feed does not bound its work; timeout does not cancel already-forwarded application work.

## Acceptance condition

On representative deployment resources, the agreed classroom burst completes within its latency target with headroom. Verification records response latency, success and error categories, query volume, and completion of work after any timeout. Privacy regressions cover outsiders, membership loss, trashed and purged openings, absent conversations, and mixed audiences. Unit tests protect read structure without machine-timing assertions.
