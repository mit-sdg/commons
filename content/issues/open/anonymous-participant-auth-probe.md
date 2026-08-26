---
milestone: public-deployment
concepts:
  - Sessioning
---

# Silence the auth probe's 401 on the participant join page

## Current behavior

The auth provider asks `/auth/me` on every page load, including `/q/[token]`,
which anonymous participants reach by design. A signed-out visitor's browser
logs a 401 console error on the one page built for signed-out visitors.

## Unresolved decision

Decide whether the probe should be skipped on participant routes, or answer
200 with an empty identity, so a page meant for anonymous devices loads
without error noise.

## Acceptance condition

A signed-out visitor opening `/q/<token>` sees no console error from the
identity probe, and signed-in participation still binds to the account.
