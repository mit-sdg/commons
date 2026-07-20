---
milestone: public-deployment
concepts:
  - Profiling
  - Sessioning
---

# Hold identity-bound pages until authentication settles

## Current behavior

On a direct load, the frontend starts rendering before the stored session,
profile, and course access have loaded. A signed-in reader can briefly see
public navigation, zero counts, empty lists, or a not-found message before the
authorized page replaces them.

## Desired behavior

While the session, profile, or course access is loading, the page shows one
loading state and withholds identity-bound navigation and content. After all
three reads finish, it shows the authorized page or the real empty, zero, or
not-found result.

## Acceptance condition

Browser tests load signed-in staff and learner routes directly. Public
navigation, zero counts, empty lists, and not-found messages never flash before
the authorized page, and a completed empty read still shows its empty result.
