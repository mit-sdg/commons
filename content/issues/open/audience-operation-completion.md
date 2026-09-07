---
milestone: public-deployment
concepts:
  - Commissioning
  - Posting
  - Conversing
  - Flagging
  - Snapshotting
  - Notifying
  - Mailing
---

# Complete private publication, reports, and delivery predictably

## Current behavior

Thread creation performs separate Posting and Conversing actions. Earlier
actions remain committed if a later action fails. The runtime does not supply
retry deduplication, and occurrence logs do not survive restart; see
[durable occurrence logs](durable-occurrence-logs.md).

[Commissioning](../../../design/concepts/Commissioning.md) records a fixed
brief and disposition, associates executions, and retains the first conclusion.
Its execution receipts make completion-before-association and
association-before-completion agree during normal execution. Round opening uses
the fixed brief to capture the admitted presentation, while sorting concludes
only after applying its result. Commissioning does not own eligibility,
exclusion, automatic recovery, or client retry identity. Its terminal history
expires, so it cannot hold a discussion's enduring audience or report evidence.

Flagging has no captured evidence. A later capture of a post's current content
could record an edit that the reporter never selected.

The mail worker reads stored pending messages and sends them without checking
current audience membership. Mailing can mark a message sent or failed, but
has no explicit cancellation or suppression outcome. Failed messages remain
pending. These contracts need completion for
[private discussion audiences](../decided/private-discussion-audiences.md).

## Unresolved decision

Choose the durable identity and state that allow an uncertain creation result
to be reconciled without blindly creating a duplicate discussion. Specify
resumption or cleanup after each interrupted action. Establishing the complete
audience is the visibility boundary, and no recovery path may fall back to
Everyone. Correlation identifiers and temporal chains alone do not provide
these guarantees. Evaluate Commissioning as the owner of a publication or
report undertaking before inventing another owner. Keep audience establishment
in Accessing and ongoing access in the current reader policy. An accepted
commission does not grant permission to execute future protected operations
after authority has ended.

When an unresolved guarantee describes a distinct course of action, write its
Purpose, Principle, State, Actions, and refusals and compare it with existing
concepts. Adopt the additional concept when that comparison earns it. Repeated
checks, incidental reaction ordering, and engine changes are not substitutes
for a missing behavior. Storage still must implement the owned invariant
atomically; a concept name alone supplies no execution guarantee.

Before reusing Commissioning, verify its merged Subject and Execution bindings.
The inspected application declaration binds Execution to Reasoning.Asking,
while round opening associates a Publishing edition. References must enumerate
their actual owners when the application broadens their use.

Choose how a report binds the exact source version selected by its reporter,
and when flag creation plus evidence capture become a completed report. An
incomplete report must not expose live content as substitute evidence.
Resolution and source-post purge retain complete evidence; a separate report
purge removes the report and its snapshot.

Define Mailing's suppression or cancellation action and the application-owned
delivery eligibility read. Recheck eligibility immediately before dispatch.
An ineligible message must not be sent, marked delivered, or left retrying as
an SMTP failure. Preserve separate delivery policies for non-forum messages.

Define authorization at read and action admission and before delivery. Ordinary
views are observations, not transactions with membership changes. State the
behavior of work already admitted when access changes; later admissions must
observe the loss of access. Dispatch that already began cannot be recalled.

## Acceptance condition

Failure-injection and restart tests cover each publication and report boundary,
including success committed before its response reaches the caller. They prove
the declared reconciliation, privacy, and duplicate-prevention behavior.

The chosen undertaking design also tests both receipt/association orders,
duplicate and contradictory late conclusions, altered inputs between stages,
revoked authority before a protected stage, and storage failure before the
consequence of a recorded receipt completes. The retained first conclusion must
describe completed work, not only a successful upstream execution. Expiry of
undertaking history cannot erase the audience or captured report evidence.

Delivery tests remove membership or archive an account with mail pending,
verify suppression and its recorded outcome, and distinguish suppression before
dispatch from revocation after dispatch has begun. Non-forum delivery remains
covered by its existing tests.
