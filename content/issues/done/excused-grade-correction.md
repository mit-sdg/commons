---
milestone: public-deployment
concepts:
  - Grading
---

# Give excused grades a correction path

## Resolution at completion

The restoreExcused action returns an excused assessment to draft with a version check. The original excusal remains in immutable release history. Excusal is a disposition, never a competency level.

## Decision at completion

Use a dedicated restoreExcused action. Preserve the original judgments internally for correction and preserve every earlier release; omit judgments from the current excused projection.

## Verification at completion

Grading tests cover excusal, restoration, retained history, and bulk release with incomplete drafts. The editor exposes Revoke excusal.
