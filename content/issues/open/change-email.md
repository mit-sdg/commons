---
milestone: later
concepts:
  - Authenticating
  - Profiling
---

# Decide how an account changes email

## Current behavior

Registration records email in Authenticating and Profiling. No action changes
it, so the settings page shows a disabled value and the two records cannot be
updated through Commons.

## Unresolved decision

Define which concept owns the account email, whether changing it requires the
password or separate verification, and how the public profile avoids keeping a
second source of truth.

## Acceptance condition

The ownership decision is reflected in the specifications, one authorized
workflow changes the address, and every read returns the same current value.
