---
milestone: later
concepts:
  - Sessioning
---

# State which browsers hold a session against the plain-HTTP development stack

## Resolution at completion

The README's "Run Commons locally" section says that local development is
served over plain `http://`, that the session cookie is a `__Host-` cookie
marked `Secure`, that Chromium-family browsers treat `127.0.0.1` as a secure
origin and hold the session while Safari drops it, and that a deployment over
`https://` holds a session in every browser. The cookie policy's binding
surface is unchanged.

## Decision at completion

The deployment-practice half of the acceptance condition was taken: the README
states which browsers local development supports and why. The upstream report,
that the engine's cookie binding offers no scheme-aware or explicit security
choice, stays drafted in the workspace's blocker drain for the engine's owner;
this repository does not work around the binding from its internals.

## Verification at completion

Read: the README paragraph beside `bun dev`. The behavior it describes was
reproduced in Playwright's WebKit before the pinned driver stopped opening a
page on this machine, and stands as the known limit of the plain-HTTP stack.
