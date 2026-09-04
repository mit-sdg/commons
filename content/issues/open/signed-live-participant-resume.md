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
conflict behavior.

## Unresolved decision

How signed responses should be found by run and participant, whether two devices may
actively edit one response, and how conflicting writes are resolved.

## Acceptance condition

A participant can begin on one device and continue the same response on another
device signed into the same account, including already saved answers and a submitted
outcome. Simultaneous-device behavior is deterministic and visible. Anonymous
participation continues to work without an account, and the ownership rule already
in place still holds under whatever resume design settles this: a different signed
participant cannot answer, submit, read, or see the wall of that response when
given its identifier.
