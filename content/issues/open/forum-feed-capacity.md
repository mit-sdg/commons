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

A local standalone-production HTTP rehearsal includes the homepage document, session and permission reads, course/dashboard reads, notification counts, and display identities after the feed. For 50 simultaneous clients, feed data arrived at p95 about 3.6–3.7 seconds after navigation with mixed audiences and 4.3–4.6 seconds with Everyone-heavy discussions. All page-data requests completed at p95 in roughly 4.7 and 5.6–5.8 seconds respectively. Concurrent private submissions completed at p95 in roughly 2.4 seconds, with exactly ten creations and outsider denial. The four workloads completed without unexpected errors. These are local HTTP-client observations with minimal dashboard data, not deployment-hardware measurements or fifty rendered browser pages.

The profile provider batches display identities in groups of at most 64 through Profiling's existing batch query. A real browser requested one batch for its homepage in each dataset; each 50-client workload made 50 display requests. The response includes names and avatars under the existing self, member, and course-manager access policy. Missing identities remain omitted, and the account-scoped presentation cache discards late responses from its previous scope. The feed still forms every eligible discussion, so batching does not bound the remaining conversation work.

## Unresolved decision

The classroom workload is 50 simultaneous student readers. Confirm the latency on deployment resources; roughly two-second p95 is the proposed target, with headroom for concurrent submissions. If full-feed formation remains too expensive, decide how much feed and summary work one request should perform. Paging before expensive enrichment or another bounded read design requires a separate scoped decision. Preserve current audience membership, missing-resource denial, and visible-only statistics.

This is ordinary classroom-use capacity work, separate from [interrupted-operation recovery and withheld delivery](audience-operation-completion.md). Increasing deadlines or retrying the full feed does not bound its work; timeout does not cancel already-forwarded application work.

## Acceptance condition

On representative deployment resources, the agreed classroom burst completes within its latency target with headroom. Verification records response latency, success and error categories, query volume, and completion of work after any timeout. Privacy regressions cover outsiders, membership loss, trashed and purged openings, absent conversations, and mixed audiences. Unit tests protect read structure without machine-timing assertions.
