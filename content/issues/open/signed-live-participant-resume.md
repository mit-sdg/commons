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
storage. A second device signed into the same account does recover the response:
beginning again under that account answers with the identifier already held. What
does not travel is the work in progress. Answers typed but not yet sent live only
in the first device's storage, so the second device shows empty boxes over a
response the server already holds answers for. Once the first device has handed in,
the second is refused `CONFLICT` with nothing on the screen to say the work is
already in. Simultaneous devices have no defined conflict behavior.

## Unresolved decision

Whether a second device should be served the answers already recorded against the
response, whether two devices may actively edit one response, how conflicting writes
are resolved, and what a device arriving after the hand-in should be shown.

## Acceptance condition

A participant can continue the same response on another device signed into the same
account, seeing the answers already recorded and, after a hand-in, the outcome and a
sentence that says the work is in rather than a bare refusal. Simultaneous-device
behavior is deterministic and visible. Anonymous participation continues to work without
an account, and the ownership rule already in place still holds under whatever resume
design settles this: a different signed participant cannot answer, submit, read, or see
the wall of that response when given its identifier.
