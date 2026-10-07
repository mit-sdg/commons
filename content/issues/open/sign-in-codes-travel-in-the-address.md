---
milestone: later
concepts:
  - Connecting
  - Vouching
---

# Sign-in codes travel in the callback address

## Current behavior

The consent page sends the browser to an app's callback with the code in the
query string, so the code is written wherever that address is: the browser's
history, the ingress log in front of the app, and the app's own request
logging. A challenge makes a code useless to whoever reads it, with one
exception. When Leo sends Sam a `/connect` link carrying Leo's own `state` and
challenge, Commons approves the app for Sam without asking again, because Sam
approved it before. If Leo then reads the code from Sam's browser history
within sixty seconds, Leo holds the matching verifier and signs in as Sam.

## Unresolved decision

- Deliver the code in the body of an automatically submitted form post to the
  callback, so it is never written into an address. Commons and the course
  apps are the same site, so the apps' cookies still reach the callback, but
  every app's callback must accept a POST.
- Or ask the person again when a sign-in arrives for an app they approved
  before, which ends the one-redirect return a returning person has today.

## Acceptance condition

A browser test shows that a code never appears in the browser's history or in
an address, or that a returning person is asked before a code is issued for
them, and `DEPLOYMENT.md` states what an app's callback must accept.
