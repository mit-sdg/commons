---
milestone: public-deployment
concepts:
  - Locating
  - Publishing
  - Questioning
  - Responding
  - Scoring
  - Snapshotting
---

# Preserve the material used by a completed live run

## Resolution at completion

Launching asks Questioning to present one coherent authored value containing the
questionnaire's title, form, disclosure, ordered questions, and scoring
projections. The launch captures that value in RunSnapshotting under the new
Publishing edition before it issues either participation address. A quiz's
Scoring key is established from the expectations returned with that same
presentation.

Participant faces, question membership, quiz completeness, staff boards, open-run
rows, and answer receipts now project from the run snapshot. Responses and scores
therefore remain attached to the exact prompts, choices, expected answers, and
explanations released for that run, while the source questionnaire can be revised
for a later class after the run closes. Locating gives each run a durable
six-character room code that resolves to its existing Sharing token; an old code
continues to reach the ordinary closed-run state rather than a different release.

## Decision at completion

Each run captures an immutable value instead of making the questionnaire itself
immutable or changing Questioning's revision lifecycle. Snapshotting is a generic
concept whose only responsibility is preserving one opaque value per subject;
Questioning's non-state-changing `present` action supplies a serialized release
point without publishing or freezing its source. The composition owns the pure
projections that conceal standards, enrich boards and receipts, decide captured
question membership and completeness, and construct a quiz key.

The room code is a separate Locating concern rather than a second credential or
an extension of Sharing. Locating owns one stable, unique code per subject and
normalizes typed codes; Sharing remains the owner of the opaque participation
token and Publishing remains the owner of the run's open and closed lifecycle.

## Verification at completion

Snapshotting concept tests cover structured capture, refusal to replace a
standing snapshot, and concurrent capture. Locating concept tests cover durable
six-character codes, normalization, malformed and unknown codes, collisions, and
concurrent ensures. Pure computation tests cover participant concealment,
snapshot-backed membership and completeness, board enrichment, and ordered answer
and explanation receipts.

Application tests launch and complete a run, record responses and a score, close
it, revise and remove source questions, and retitle the questionnaire; the old
participant face, receipt, score, and staff board retain the launched material. A
concurrent unready-to-ready edit test proves that launch either refuses without a
hidden open run or captures a ready presentation whose key and participant face
agree. Playwright drives typed-code joining, participation, grading, closing, and
the same launch/edit boundary through the deployed HTTP and browser surfaces.
