---
milestone: public-deployment
concepts:
  - Connecting
  - Vouching
---

# Bind each sign-in code to the app request that asked for it

## Resolution at completion

A course app signs a person in with Proof Key for Code Exchange (RFC 7636)
using the `S256` method. For each sign-in, the app's server makes a random
verifier and keeps it, and the `/connect` address carries its SHA-256 hash as
`code_challenge`, with `code_challenge_method=S256`. Redeeming at
`POST /api/connect/redeem` takes `{code, app, code_verifier}`. A code read from
a callback address, a log, or browser history can no longer be redeemed by
whoever read it, even through the same app, because their sign-in holds a
different verifier.

Every app must send a challenge, except the owner portal at
`CONNECT_APP_DOMAIN` itself, which signed people in before challenges existed.
A missing method (which RFC 7636 reads as `plain`), any method but `S256`, or a
challenge that is not 43 base64url characters is refused with
`CONNECT_CHALLENGE_INVALID` before anything is remembered, and the consent
page shows an error instead of sending the browser anywhere. A missing, wrong,
or malformed verifier gets the same single refusal as every other redemption
failure, `400 {"error":"CONNECT_CODE_INVALID"}`, and spends the code. A
verifier sent for a code issued without a challenge is refused the same way, so
a request cannot be downgraded (RFC 9700, section 2.1.1).

## Decision at completion

The challenge lives on the voucher, not the connection. A challenge belongs to
one sign-in and lives exactly as long as its code, while a connection is a
lasting approval. Vouching gained an optional counterpart: a voucher issued
with one is honored only for someone who presents the same counterpart, absent
agrees only with absent, and presenting a standing voucher's credential with a
counterpart that does not agree discards the voucher. `verify` follows the same
rule as `redeem`. Vouching compares counterparts and knows nothing of hashing.
The composition hashes the verifier and passes the result as the counterpart.
Password reset passes no counterpart and is unchanged.

The challenge is required from the start for every app but the owner portal,
because no other app had signed anyone in yet. Making it optional would have
left a breaking change for later, once student apps were deployed. Removing the
portal's exception is
[its own issue](the-owner-portal-signs-in-without-a-challenge.md).

The engine's records redact `credential`, `code_verifier`, and `verifier` by
field name. The `code` field is not redacted, because class codes and live-room
codes share the name, and a code issued with a challenge is useless without its
verifier.

## Verification at completion

Vouching's concept tests cover a counterpart that agrees, one that differs or
is missing (which spends the voucher, through `redeem` and through `verify`),
one presented for a voucher issued without one, including the empty string,
and a wrong credential, which spends nothing. The computation tests pin the
RFC 7636 Appendix B pair and the challenge rules. Edge tests drive
`/connect/describe`, `/connect/approve`, and `/connect/redeem` through
`edge.fetch`: a correct verifier redeems for every kind of app, a missing,
wrong, or malformed verifier is refused and spends the code, every malformed
challenge or method is refused at describing and approving with nothing
remembered, a verifier on a portal code issued without a challenge is refused,
and the retained records hold no verifier or credential. The browser test
follows the redirect with a challenge and redeems with its verifier, and a
request without a challenge, or with a malformed one, goes nowhere.
