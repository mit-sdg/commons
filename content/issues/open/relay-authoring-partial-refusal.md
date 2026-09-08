---
milestone: public-deployment
concepts:
  - Questioning
  - Relaying
---

# Recover interrupted round authoring

## Current behavior

Round creation and revision validate complete material before mutation, so invalid input leaves no new questionnaire and preserves existing title, prompt, choices, parts, and cap. Endpoint tests cover these refusals and valid shape changes.

The subsequent concept actions remain separate writes. A concurrent retirement, removal, or storage interruption can still prevent completion after an earlier action succeeded. Input validation does not provide rollback or crash recovery.

## Unresolved decision

Determine how authors recover a partially completed request after interruption or a conflicting concurrent edit, including how an unattached questionnaire is found and removed.

## Acceptance condition

Fault and concurrency tests exercise each authoring write boundary. A refused or interrupted request either preserves the prior round or exposes enough state for the author to recover it without losing work.
