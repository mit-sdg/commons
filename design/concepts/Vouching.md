# Vouching

## Purpose

Issue an expiring, single-use voucher whose credential proves that the bearer
was entrusted with it, so an application can accept one act on a subject's
behalf from whoever presents one.

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

Vouching does not know what a voucher is for, how its credential travels, or
how often the application is willing to issue one. A composition chooses the
entitlement, the delivery route, and the pace.

## Types

```types
external Subject
  An application-owned identity used in the subject role.
```

## State

```state
a set of Vouchers with
  a subject   Subject
  an issuedAt Date
  an expiresAt Date

Rule: a credential is derived from the voucher identifier with a deployment secret; it is stable but is never stored by Vouching.
Rule: a subject holds at most one voucher, because issuing discards the subject's earlier vouchers.
Rule: redeeming a voucher discards it, so each credential is honored at most once.
Rule: a voucher past its expiry is never honored; the application chooses the expiry when it issues.
```

## Actions

```actions
issue(subject: Subject, at: Date, expiresAt: Date) : return (voucher: Voucher, subject: Subject, credential: String)
  where expiresAt is after at
  then
    discard the subject's vouchers
    add a new voucher with subject, issuedAt at, and expiresAt
    return voucher, subject, credential
  where expiresAt is not after at
  then
    refuse VOUCHER_EXPIRY_INVALID "The voucher expiry must come after its issue time."

verify(voucher: Voucher, credential: String, at: Date) : return (voucher: Voucher, subject: Subject)
  where voucher exists, credential matches, and at is before its expiresAt
  then
    return voucher, subject
  where no voucher matches, credential does not match, or at is not before its expiresAt
  then
    refuse VOUCHER_INVALID "That voucher is not valid."

redeem(voucher: Voucher, credential: String, at: Date) : return (voucher: Voucher, subject: Subject)
  where voucher exists, credential matches, and at is before its expiresAt
  then
    discard the voucher
    return voucher, subject
  where no voucher matches, credential does not match, or at is not before its expiresAt
  then
    refuse VOUCHER_INVALID "That voucher is not valid."
```

## Queries

```queries
_getIssuedSince (subject: Subject, since: Date) : many (voucher: String, issuedAt: Date, expiresAt: Date)
  answers the subject's vouchers issued at or after since, without their credentials
  orders rows by issue from newest to oldest
  answers no rows when none match, which tells the application that issuing again would be the first issue since then
```
