---
milestone: later
concepts:
  - Relaying
  - Reasoning
---

# Preserve original examples when sampling after a vote

## Resolution at completion

The preview sampler resolves the bounded relay dependency graph from server-owned samples. A written response carried into a vote remains associated with its choice when selected for a follow-up. Ballots are not substituted for narrative evidence. The preview receives the same selected groups as the model passage.

## Decision at completion

Preview-only assumed picks default to the first three available source groups and can be changed without changing the relay or a live run. A vote exposes its offered choices after sampling; a choice without a ballot has no downstream narrative evidence, matching live opening. A source-revision digest propagates upstream edits, changed picks and resampling through dependent passages. Source-input freshness remains separate from current-result freshness.

## Verification at completion

Application tests in `tests/app/round-sampling.test.ts` exercise write → vote → follow-up and inspect the original written evidence in the model passage. They cover changed selections, upstream notes, resampling with identical answers, transitive freshness and independent samples. Computation tests cover bounded defaults, explicit empty picks, group associations and zero-vote choices. Browser coverage in `tests/e2e/relay-polish.spec.ts` verifies shared generation, assumed picks and stale-result presentation. The governing authoring issue records the integrated checks.
