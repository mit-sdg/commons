# Sharing

## Purpose

Hand someone a token that opens onto one intended thing, so that reaching it
takes nothing more than having been given the token — no account, no address
book, no search.

## Principle

When Professor Lee's quiz run is published, a share is issued for it and its
token goes up on the lecture screen. Leon presents the token from his phone and
arrives at the run; his neighbor, given the same token another way, arrives at
the same place. A mistyped token reaches nothing and says so. Weeks later the
same token still opens onto the same run, whatever state the run is in by then.

## Types

```types
external Subject
  An application-owned identity a share opens onto.
```

## State

```state
a set of Shares with
  a subject Subject
  a token   String

Rule: tokens are unique among shares, and a token is minted unguessably the way an identity is.
Rule: nothing restricts a subject to one share, so a subject may hold several with distinct tokens.
Rule: open changes no state; it is kept an action deliberately, so that if arrivals are ever to be remembered, open is where the recording lands without any caller changing.
Rule: a QR code and a printed readable address are two renderings of the same token and appear nowhere in state.
Rule: Sharing does not render tokens, decide who may be given one, revoke or expire them, or interpret what the subject's own state permits on arrival — what a visitor finds after arriving is the subject's own state to report.
```

## Actions

```actions
issue (subject: Subject) : return (share: Share, token: String)
  where true
  then
    add a new share with subject and a freshly minted token
    return share, token

open (token: String) : return (subject: Subject)
  where a share has token token
  then
    return subject
  where no share has token token
  then
    refuse NOTHING_SHARED "Nothing is shared here."
```

## Queries

```queries
_share (token: String) : optional (share: String, subject: String)
  answers the Share holding the token and its subject
  answers no row when no share holds the token

_sharesFor (subject: String) : many (share: String, token: String)
  answers the subject's shares in issue order
  answers no rows when none match
```
