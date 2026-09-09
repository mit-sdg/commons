---
milestone: public-deployment
concepts:
  - Sessioning
  - Grading
---

# Recover safely when a frontend session expires

## Current behavior

Sessions expire one day after sign-in. Protected backend routes check the stored
expiry and reject an expired session with HTTP 401, clear its cookie, and prevent
the requested read or mutation. Activity does not extend that expiry.

The general frontend retains its authenticated identity after these refusals.
An expired grading save shows “Sign in and try again,” but leaves learner work,
draft feedback, and the enabled Save button visible. Released feedback also
remains visible after the notification poll receives 401. Reloading redirects to
sign-in but discards unsaved editor changes; previously saved work is unaffected.

This was reproduced with synthetic staff and learner accounts by moving the
stored session expiry into the past. All 302 protected routes rejected the
expired cookie, and a refused grading save left the stored assessment unchanged.

## Unresolved decision

Define a shared frontend transition for an expired session and a reauthentication
flow that hides protected content and handles unsaved work without exposing it
to another account. Decide how to retain and restore an account's unsaved editor
state while maintaining the existing live-activity sign-in flows.

Changing the fixed lifetime or adopting sliding expiry is a separate decision
tracked in `session-expiry-is-fixed-not-sliding.md`; extending the lifetime alone
does not fix recovery when access ends.

## Acceptance condition

Browser tests expire a session during staff grading and while learner feedback
is open. A protected-request refusal ends the frontend's authenticated state,
hides private content, and offers sign-in. Unsaved-work recovery remains bound to
the original verified account; saves and releases are never replayed
automatically. Failed login requests do not trigger an expiry loop, simultaneous
refusals converge on one recovery flow, and a late refusal from an older session
cannot invalidate a newer login. Existing live-activity reauthentication and
ordinary sign-out/account switching continue to work.
