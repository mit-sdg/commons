---
milestone: later
concepts:
  - Authenticating
  - Responding
  - Sessioning
---

# Resume a signed live response across devices

## Current behavior

A signed participant's response and draft answers are restored from browser-local
storage. A second device signed into the same account knows the participant and run
but cannot recover the existing response identifier, so following the run's QR link
does not continue the first device's work. Simultaneous devices have no defined
conflict behavior. Participant answer, submit, and outcome operations also accept
the opaque response identifier without rechecking ownership against a signed
session.

## Unresolved decision

How signed responses should be found by run and participant, whether two devices may
actively edit one response, how conflicting writes are resolved, and whether
anonymous responses should retain their current device-bound capability behavior
while signed responses require authenticated ownership.

## Acceptance condition

A participant can begin on one device and continue the same response on another
device signed into the same account, including already saved answers and a submitted
outcome. Simultaneous-device behavior is deterministic and visible, and a different
signed participant cannot answer, submit, or read that response even when given its
identifier. Anonymous participation continues to work without an account.
