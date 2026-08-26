---
milestone: public-deployment
concepts:
  - Publishing
  - Questioning
  - Responding
  - Scoring
---

# Preserve the material used by a completed live run

## Current behavior

A live run identifies the questionnaire edition launched for it, but its dashboard
and participant outcomes still form question text, answer choices, expected answers,
and explanations from the questionnaire's current material. Editing that
questionnaire after a run therefore changes what a completed run appears to have
asked and can change the context in which its recorded responses and scores are
read.

## Unresolved decision

Whether launch should create a fully immutable material snapshot for the run, or
whether a launched questionnaire edition should become immutable and later edits
should always create a new edition.

## Acceptance condition

An application test launches and completes a run, records participant responses,
then edits the source questionnaire. The completed run's questions, choices,
expected answers, explanations, responses, and scores remain exactly as they were
at launch, while a later run can use the revised material.
