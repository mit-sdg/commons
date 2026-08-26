---
milestone: later
concepts:
  - Sessioning
---

# Hold a session in every browser when the stack serves plain HTTP

## Current behavior

The HTTP profile issues the session cookie as `__Host-commons-session` with
`Secure`, unconditionally. Over the local development stack's `http://`
origin, Chromium-family browsers accept it — they treat `127.0.0.1` as a
trustworthy origin — but Safari follows the letter of the cookie spec and
silently drops it. Signing in then succeeds (the toast appears) while no
session is stored, so the client bounces between the home page and the login
page indefinitely. Every automated browser check runs on Chromium, which is
why nothing caught it; the failure reproduces immediately in Playwright's
WebKit.

The cookie policy's binding surface offers no `secure` choice and no
scheme-aware behavior, so the application cannot express a development cookie
without one of: a Chromium browser, or an `https` development origin.

## Unresolved decision

Whether the fix belongs upstream (the cookie binding grows a scheme-aware or
explicit security choice) or in deployment practice (development is served
over `https`, and the README says so). The upstream report is drafted in the
workspace's blocker drain.

## Acceptance condition

Signing in against `bun dev` holds a session in Safari — or the README states
plainly which browsers local development supports and why, with the upstream
issue filed.
