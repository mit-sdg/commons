---
milestone: public-deployment
concepts:
  - Questioning
  - Relaying
---

# Preserve authored rounds when a request is refused

## Current behavior

Round creation and revision perform several concept actions in sequence. A
later refusal does not roll back the actions that already succeeded.

Adding a round with choices and nonempty parts returns INVALID_PARTS after
creating a questionnaire and question, before adding a leg. The questionnaire
remains unretired without a relay leg.

Revising a two-part round with a blank prompt returns INVALID_PROMPT after
clearing the existing parts. The original prompt remains, but its parts are
lost. Serializing each concept's actions does not make the complete authoring
request atomic. The composition's claim that one request prevents a half-made
round is stronger than this behavior.

## Unresolved decision

Determine how to validate the complete authored replacement before mutation
and preserve prior work when an action is refused. Distinguish ordinary input
refusals from concurrent changes and interrupted storage operations. Do not
weaken Questioning's intrinsic validation to let a partially applied request
finish.

## Acceptance condition

Invalid round creation leaves no orphan questionnaire. An invalid revision
preserves the prior title, prompt, choices, parts, and cap. Endpoint tests cover
failures at each mutation boundary, and the composition states its actual
atomicity and recovery limits.
