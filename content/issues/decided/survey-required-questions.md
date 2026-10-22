---
milestone: later
concepts:
  - Questioning
  - Responding
---

# Let a survey mark questions as required

## Current behavior

A survey run is handed in as it stands. The survey branches of
`Live.participation.Submit` and `SubmitSigned` call `Responding.submit` without
requirements, so a participant can hand in a survey with every question blank.
Quizzes and relay rounds already pass every captured item as required, and
`Responding.submit` refuses an incomplete hand-in with `INCOMPLETE`.

## Desired behavior

An author marks individual survey questions as required, and a survey cannot be
handed in until each required question has an answer. Nothing is required unless
the author marks it.

The mark is a question field, not a separate concept. A separate set of marks
would have to be captured at launch, cleaned up when a question is removed or
shed, and guarded against edits during an open run, while a field gets each of
those from the questionnaire it belongs to. Responding's `required` groups are
already the generic hand-in check.

- Questioning: each question gains `required`, false by default, set by a new
  `setRequired` action shaped like `setParts`. `addQuestion` and
  `reviseQuestion` keep their signatures, so drafting adoption and refinement
  are unchanged and a revised question keeps its mark. A stored question
  without the field reads as not required. `present` includes the mark.
- Live: `Live.quizzes.SetRequired` sets the mark under the same `live:host`,
  `RUN_OPEN`, and retired guards as the other questionnaire edits. The survey
  submit branches pass the required items of the captured presentation (each
  part of a labeled question, or any one repetition of a repeated box). Quiz
  and relay branches are unchanged, and a run captured before the field
  existed requires nothing.
- Frontend: the editor shows a Required switch on survey questions only. The
  participant page labels required questions and keeps Hand in disabled until
  they are answered.

## Acceptance condition

Concept and app tests confirm the default, the mark surviving revision and
reorder, edit refusal during an open run, a survey hand-in refused with
`INCOMPLETE` while a required question is blank and accepted once it is
answered, unmarked surveys and old run snapshots handing in as before, and
quiz and relay hand-in unchanged. Spec and wire goldens are re-pinned for the
new endpoint and the question field.
