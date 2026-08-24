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

A person who forgets their password asks for a reset from the sign-in page,
signed out: the two pages and the two endpoints they call are served without a
session. Commons accepts any well-formed address with the same answer, issues an
expiring, single-use PasswordResetVouching voucher for the account holding that
address, and queues a Mailing message carrying a reset link and a reset code.
Presenting both with an acceptable new password replaces the account's verifier,
discards its voucher, and ends all of its sessions.

## Decision at completion

Reset tokens are a new generic concept, Vouching, rather than an extension of
Inviting, whose invitations are deliberately durable and non-expiring. Its one
registered instance is named PasswordResetVouching, so the reaction that mails a
reset code answers this errand rather than every future use of a voucher.
Authenticating gains `resetPassword`, which replaces the verifier without the
current password and leaves proof of ownership to the composition, and reuses
its existing case-blind `_getByEmail`, which answers the one account holding an
address. Vouchers lapse one hour after the request, and issuing supersedes the
account's previous voucher, so at most one reset code stands at a time. Because
the request endpoint is public, the composition also declines to issue a second
voucher within five minutes of the last one, which bounds both the mail an
unauthenticated stranger can aim at an inbox and the state a request can create.
Reset codes are derived from `VOUCHER_SECRET`, a new deployment secret required
in production, where startup now also refuses a secret shorter than 32
characters or equal to `INVITATION_SECRET`. The request endpoint never reveals
whether an address is registered; unknown, superseded, wrong-code, and lapsed
vouchers all receive one indistinguishable refusal.

## Verification at completion

Concept tests cover Vouching's expiry, single use, supersession, the
issued-since query, and credential mismatch, and Authenticating's reset.
Application tests drive the full flow — request, rendered mail with link and
code, reset, old sessions ended, old password refused, new password accepted,
and a second redemption refused — and separately drive both endpoints through
`edge.fetch` without a session, which is the boundary a signed-out person
actually meets. A cooldown test shows four rapid requests leaving one voucher
and one queued message.
