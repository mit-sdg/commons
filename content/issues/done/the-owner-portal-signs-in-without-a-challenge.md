---
milestone: public-deployment
concepts:
  - Vouching
---

# The owner portal signs in without a challenge

## Resolution at completion

Every app, including the owner portal at `CONNECT_APP_DOMAIN` itself, must
send a 43-character base64url `code_challenge` with
`code_challenge_method=S256` on each sign-in. Describing or approving a
request without an acceptable challenge is refused with
`CONNECT_CHALLENGE_INVALID` before any connection or voucher is remembered.
Every sign-in code is issued with a challenge and redeems only with the
matching `code_verifier`.

## Decision at completion

The owner portal sends a challenge and its method on every sign-in and redeems
with `{code, app, code_verifier}` since mit-sdg/openstack-deployment-infra#90.
Its verifier is derived from the signed binder cookie, as the open issue
suggested, so the portal still stores nothing per sign-in. The exception was
removed once that portal release was live, so no portal sign-in was refused.

The challenge check no longer takes an app or a configured domain. Vouching
keeps its generic counterpart rules, including vouchers issued without a
counterpart, because password reset uses those rules.

## Verification at completion

Computation tests refuse a missing challenge or method for every app. Edge
tests refuse the portal origin without a challenge at describing and
approving, check the domain refusal `CONNECT_CHALLENGE_INVALID` and its HTTP
category `INVALID_REQUEST`, and find no connection or voucher remembered.
Portal codes in the remaining edge tests are issued with a challenge and
redeemed with its verifier. The browser tests send a challenge and redeem
with its verifier, and refuse a request without a challenge.

The deployment instructions, composition explanation, and application
specification require a challenge from every app. The specification and wire
files are regenerated with the repository's artifact commands.
