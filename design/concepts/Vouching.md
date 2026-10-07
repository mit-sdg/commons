# Vouching

## Purpose

Issue an expiring, single-use voucher whose credential proves that the bearer
was entrusted with it, so an application can accept one act on a subject's
behalf from whoever presents it. A voucher issued with a counterpart is
honored only for someone who also presents that counterpart.

Prevents: a credential honored twice, after a newer one replaced it, or after
it lapsed; a credential read on its way to its holder and then redeemed by the
reader.

## Principle

The application issues a voucher for Nadia's account, choosing an expiry, and
sends her the voucher's credential outside the application. Issuing again for
the same account supersedes the first, so only the credential Nadia received
most recently stands. Before the expiry, presenting the voucher and credential
redeems it: Vouching answers with her account and discards the voucher, so that
credential never works again.

When Omar presents a guessed credential, a superseded or already-redeemed
voucher, or one past its expiry, he is refused with the same answer each time,
without learning which check failed.

The application can also issue a voucher with a counterpart, a value that
travels apart from the credential. Nadia's next voucher is issued with one.
When Omar reads her credential on its way to her and presents it with another
counterpart, or with none, he is refused with the same answer, and the voucher
is discarded, so the credential he read never works for anyone. A counterpart
presented for a voucher issued without one is refused the same way.

Vouching does not know what a voucher is for, how its credential travels, what
a counterpart stands for or how the application derives it, or how often the
application is willing to issue one. A composition chooses the entitlement, the
delivery route, and the pace.

## Types

```types
external Subject
  An application-owned identity used in the subject role.
```

## State

```state
a set of Vouchers with
  a subject   Subject
  an optional counterpart String
  an issuedAt Date
  an expiresAt Date

Rule: a credential is derived from the voucher identifier with a deployment secret; it is stable but is never stored by Vouching.
Rule: a subject holds at most one voucher, because issuing discards the subject's earlier vouchers.
Rule: redeeming a voucher discards it, so each credential is honored at most once.
Rule: a voucher past its expiry is never honored; the application chooses the expiry when it issues.
Rule: a presented counterpart agrees with a voucher when both are absent, or both are present and equal; an empty string is a present counterpart.
Rule: presenting a standing voucher's credential with a counterpart that does not agree discards the voucher, because the credential has reached someone who does not hold its counterpart; a credential that does not match discards nothing.
```

## Actions

```actions
issue(subject: Subject, at: Date, expiresAt: Date, counterpart?: String) : return (voucher: Voucher, subject: Subject, credential: String)
  where expiresAt is after at
  then
    discard the subject's vouchers
    add a new voucher with subject, counterpart when given, issuedAt at, and expiresAt
    return voucher, subject, credential
  where expiresAt is not after at
  then
    refuse VOUCHER_EXPIRY_INVALID "The voucher expiry must come after its issue time."

verify(voucher: Voucher, credential: String, at: Date, counterpart?: String) : return (voucher: Voucher, subject: Subject)
  where voucher exists, credential matches, at is before its expiresAt, and counterpart agrees with the voucher's
  then
    return voucher, subject
  where no voucher matches, credential does not match, at is not before its expiresAt, or counterpart does not agree with the voucher's
  then
    discard the voucher when it exists, its credential matches, and at is before its expiresAt
    refuse VOUCHER_INVALID "That voucher is not valid."

redeem(voucher: Voucher, credential: String, at: Date, counterpart?: String) : return (voucher: Voucher, subject: Subject)
  where voucher exists, credential matches, at is before its expiresAt, and counterpart agrees with the voucher's
  then
    discard the voucher
    return voucher, subject
  where no voucher matches, credential does not match, at is not before its expiresAt, or counterpart does not agree with the voucher's
  then
    discard the voucher when it exists, its credential matches, and at is before its expiresAt
    refuse VOUCHER_INVALID "That voucher is not valid."
```

## Queries

```queries
_getIssuedSince (subject: Subject, since: Date) : many (voucher: String, issuedAt: Date, expiresAt: Date)
  answers the subject's vouchers issued at or after since, without their credentials or counterparts
  orders rows by issue from newest to oldest
  answers no rows when none match, which tells the application that issuing again would be the first issue since then
```
