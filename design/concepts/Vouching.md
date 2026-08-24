# Vouching

## Purpose

Issue expiring, single-use vouchers whose credentials prove that the bearer
was entrusted with them, so an application can accept one act on a subject's
behalf from whoever presents one.

## Principle

The application issues a voucher for Nadia's account, choosing an expiry, and
sends her the voucher's credential outside the application. Before the expiry,
presenting the voucher and credential redeems it: Vouching answers with her
account and discards the voucher along with any others outstanding for it, so
no credential for that account works again.

When Omar presents a guessed credential, an already-redeemed voucher, or one
past its expiry, he is refused with the same answer each time, without
learning which check failed.

Vouching does not know what a voucher is for or how its credential travels. A
composition chooses the entitlement and the delivery route.

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
Rule: redeeming a voucher discards it and the subject's other vouchers, so each credential is honored at most once.
Rule: a voucher past its expiry is never honored; the application chooses the expiry when it issues.
Rule: issuing a voucher discards the subject's vouchers that have already expired.
```

## Actions

```actions
issue(subject: Subject, at: Date, expiresAt: Date) : return (voucher: Voucher, subject: Subject, credential: String)
  where expiresAt is after at
  then
    discard the subject's vouchers whose expiresAt is at or earlier
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
    discard the voucher and the subject's other vouchers
    return voucher, subject
  where no voucher matches, credential does not match, or at is not before its expiresAt
  then
    refuse VOUCHER_INVALID "That voucher is not valid."
```

## Queries

```queries
_getForSubject (subject: Subject) : many (voucher: String, issuedAt: Date, expiresAt: Date)
  answers the subject's vouchers without their credentials
  orders rows by issue from newest to oldest
  answers no rows when none match
```
