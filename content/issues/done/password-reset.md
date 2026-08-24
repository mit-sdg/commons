---
milestone: public-deployment
concepts:
  - Authenticating
  - Vouching
  - Mailing
  - Sessioning
---

# Let a person reset a forgotten password by email

## Resolution at completion

A person who forgets their password asks for a reset from the sign-in page.
Commons accepts any well-formed address with the same answer, issues an
expiring, single-use Vouching voucher for the account holding that address,
and queues a Mailing message carrying a reset link and a reset code. Presenting
both with an acceptable new password replaces the account's verifier, discards
the account's outstanding vouchers, and ends all of its sessions.

## Decision at completion

Reset tokens are a new generic concept, Vouching, rather than an extension of
Inviting, whose invitations are deliberately durable and non-expiring.
Authenticating gains `resetPassword`, which replaces the verifier without the
current password and leaves proof of ownership to the composition, and reuses
its existing case-blind `_getByEmail`, which answers the one account holding an
address. Vouchers lapse one hour
after the request. Reset codes are derived from `VOUCHER_SECRET`, a new
deployment secret required in production. The request endpoint never reveals
whether an address is registered; unknown, wrong-code, and lapsed vouchers all
receive one indistinguishable refusal.

## Verification at completion

Concept tests cover Vouching's expiry, single use, sibling discard, and
credential mismatch, and Authenticating's reset.
An application test drives the full flow: request, rendered mail with link and
code, reset, old sessions ended, old password refused, new password accepted,
and a second redemption refused.
