---
milestone: later
concepts:
  - Relaying
  - Reasoning
  - Guiding
  - Questioning
---

# Make AI-authored relays coherent and their preview trustworthy

## Resolution at completion

All three checkpoints are complete: selected preview context, measured participant fidelity, and usable authoring and hosting. Relay drafting describes a live collaborative experience, infers relevant dependencies, preserves independent rounds, and uses the author's selected reference documents. Preview sampling and participant presentation now use the same explicit selection of source groups, including original written evidence carried through a vote.

Relay descriptions and structured hosting guidance are persisted, editable, and available beside the relevant rounds. The preview remains reachable with long content on desktop and constrained layouts. Part-label fields grow within their row, and the document library uses the shared page container.

## Decision at completion

A connected relay builds on earlier contributions when the next activity needs them; it does not require every round to depend on the immediately preceding round. Independent reflection and new contributions remain possible. The drafting contract asks intermediate contributions and grouping guidance to retain the concrete details later work requires. The existing Insisting mechanism rejects partial, self, and forward takes through bounded repair. No extra semantic correction call or phrase-based dependency guard is added: the evaluated correction could change the author's activity to make it answerable.

Preview-only assumed picks default to the first three available source groups and can be changed without changing the relay or a live run. Server-owned source samples determine both model input and the participant frame. Written examples retain their association with sampled vote choices; a choice without a ballot has no downstream narrative evidence, matching live opening. The narrower issue `content/issues/done/relay-preview-context-through-votes.md` records that resolution.

Selected material is rendered according to its carry use:

- `context`: supporting groups and responses appear above the prompt;
- `parts`: selected group names become answer boxes with their associated supporting responses;
- `choices`: selected group names become choices with expandable supporting responses.

Source identity, synthetic provenance, assumed picks, freshness and generation controls remain outside the participant frame. The same question component presents real participant questions and previews. Long source cards remain available without forcing every card open.

Source-input freshness is separate from current-result freshness. Source revisions propagate upstream edits, pick changes and resampling to dependent results. Unrelated edits do not invalidate independent samples. A change to carry use updates the participant structure while retaining fresh source input. Stale current results are replaced by an explicit refresh state. Shared generation prepares missing or stale ancestors oldest-first, then generates the selected round and reveals Example results only on success. Request identity prevents an older reply from becoming fresh after configuration changes.

The desktop preview body scrolls within the available viewport height while round identity, tabs and generation remain visible. Scrolling or focusing preview controls preserves the selected round. Scroll anchoring does not move the editor page when preview content changes.

Descriptions explain the activity and its expected output without promising consensus or agreement merely because participants vote. Relay guidance has opening and closing fields; round guidance has purpose, facilitation and source selection fields. Selection guidance is effective only while a later round consumes that source, but inactive authored text is retained. Generation, narrow revision, copying, editing and reload preserve the corresponding fields. Hosting guidance remains outside participant APIs, snapshots and projection.

Direct participant comparisons support a scoped instruction to preserve supplied source facts, constraints and group associations while allowing requested invention. The existing sorting contract is retained because comparisons did not establish a consistent gain from its rewrites. No broader sampling rewrite is adopted. The bounded comparisons and their limitations are summarized below; experimental runners and raw evidence are excluded from the public tree. Model usefulness is assessed from the actual responses, not inferred from structural acceptance. The remaining completeness and repair-policy decisions stay in `content/issues/open/model-output-reader-completeness.md`.

## Verification at completion

Application and computation coverage exercises write → vote → follow-up, bounded and empty selections, original source evidence, zero-vote choices, transitive freshness, identical-text resampling, request races, independent samples, guide persistence and narrow revisions. Snapshot and question tests cover carry-specific participant presentation and exclusion of host guidance.

The final direct comparison used six supplied participant presentations, two variants and three repeats: 36 real model calls. Both variants passed structural coverage and applicable exact-choice checks; the candidate corrected a concrete source-timing reversal in the equipment case, while other cases showed no clear gain. Six subsequent calls verified the final production passage. Thirteen host-guide calls checked structured guidance and revisions; the last two exercised the final description wording. These bounded results support fidelity and steerability improvements, not a guarantee of creativity or semantic completeness. Historical model evidence can be recovered from development commit `84a74e4`; it is not part of the maintained application.

The integrated application suite passed 1,010 backend tests with one existing opt-in skip and 334 frontend tests. The engine suite passed 581 tests. Five focused browser cases passed; the expanded bounded-preview case passed again after the final focus and scroll-anchor fixes. Visual inspection covered desktop overflow, constrained and mobile previews, mobile participant evidence, part labels, host guidance and document-page alignment.

`bun run check` passes with zero lint or type warnings, and spec/wire artifacts are pinned. The source analyzer separately reports 378 advisories; they are not a zero-advisory result. The emitted application contains 257 computes, 148 views and 105 formers, so the historical zero-compute target is not met by the current application. No engine implementation was changed for this work.

## Final author and visual review

A subsequent release polish pass made generated descriptions and round purposes visible without opening editing folds, added shared host help for selection and advancement, distinguished the session guide from general relay instructions, and gave mobile round cards their full width. Part labels wrap and their removal controls remain visible on touch layouts. Mobile previews now open through an explicit round-labelled disclosure.

The final review included fresh-host model rehearsals, isolated literature evidence checks, and an independent visual inspection. The broader guidance rewrite was rejected; only the separately tested literature evidence example was retained. No extra semantic correction call was introduced. The existing reader-completeness issue retains the unresolved semantic limits.
