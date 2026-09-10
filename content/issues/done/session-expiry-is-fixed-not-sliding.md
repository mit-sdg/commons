---
milestone: later
concepts:
  - Sessioning
---

# Refresh active sessions within a semester cap

## Resolution at completion

New sessions have a 72-hour idle deadline and a four-calendar-month absolute cap.
Successful protected HTTP requests refresh the idle deadline, including polling.
The login cookie expires at the fixed cap and is not rewritten during renewal.
Shared access checks reject archived accounts even if session deletion failed.

## Decision at completion

The absolute cap is measured in UTC, preserves time of day, and clamps month-end
starts to the last day of the target month. It can require a new login during
activity at semester's end. Direct application invocations do not renew sessions.
Public, failed, logout, and password-change requests do not renew the presented
session. Renewal never revives expired or revoked sessions and does not replace
a completed response if its database write fails. Legacy sessions keep their
original fixed expiry until the next login; no migration is needed.

## Verification at completion

Concept tests cover exact idle and absolute boundaries, leap-year and month-end
caps, persistence, legacy records, monotonic renewal, and concurrent revocation.
HTTP tests cover fixed cookie expiry, successful-use renewal, excluded requests,
renewal failure after a mutation, expiry and revocation during a request, and
archived accounts with retained sessions. Existing logout and password-change
coverage remains in place.
