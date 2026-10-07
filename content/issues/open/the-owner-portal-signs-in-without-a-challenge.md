---
milestone: public-deployment
concepts:
  - Vouching
---

# The owner portal signs in without a challenge

## Current behavior

Every app must send an `S256` challenge with each sign-in, except the owner
portal at `CONNECT_APP_DOMAIN` itself, which signed people in before challenges
existed. A code issued to the portal without a challenge can be redeemed by
whoever reads it within its sixty seconds, by naming the portal's origin.

The portal keeps no server-side record of a sign-in in progress: a signed
binder cookie is its only record, and its `state` is derived from the binder.
It can derive the verifier from the binder in the same way, so it needs no new
storage. Its broker builds the `/connect` address and redeems the code, and its
identity service forwards the redemption and checks the request's fields, so
the two must be deployed together.

## Unresolved decision

- When the portal sends a challenge with every sign-in, Commons removes the
  exception from `isConnectChallenge`. The portal's maintainers say when their
  release is live; Commons keeps no count of codes issued without a challenge.

## Acceptance condition

`isConnectChallenge` accepts a request without a challenge from no app, the
edge and computation tests that let the portal through are changed to refuse
it, and `DEPLOYMENT.md` and the Sign in with Commons explanation no longer
mention the exception.
