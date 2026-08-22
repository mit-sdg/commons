# Inviting

## Purpose

Issue durable, single-use invitations through an application-selected delivery
channel.

## Principle

An administrator invites Nadia at an address on a delivery channel. The
application creates one durable, non-expiring invitation with a temporary credential.
Inviting the same channel and address again returns the same invitation and
credential; it does not rotate them. Nadia uses both values to claim the
invitation once.

When an administrator retracts an unclaimed invitation, it is deleted and its
temporary credential can no longer be used. Retracting a claimed invitation or
an unknown invitation is refused.

Inviting does not interpret channels or addresses. A composition chooses the
channel and delegates validation, normalization, and delivery to the concept
that owns that channel.

## Types

```types
external User
  An application-owned identity used in the user role.
```

## State

```state
a set of Invitations with
  a channel            String
  an address            String
  a createdAt          Date
  a lastInvitedAt      Date
  an inviteCount       Number
  an optional user     User

Rule: an invitation has no expiry.
Rule: a credential is derived from the invitation identifier with a deployment secret; it is stable but is never stored by Inviting.
```

## Actions

```actions
invite(channel: String, address: String, at: Date) : return (invitation: Invitation, channel: String, address: String, credential: String, created: Boolean)
  where no invitation has channel and address
  then
    add a new invitation with createdAt and lastInvitedAt at, inviteCount 1, and no user
    return invitation, channel, address, credential, created
  where an unclaimed invitation has channel and address
  then
    set its lastInvitedAt to at and increment its inviteCount
    return invitation, channel, address, credential, created
  where a claimed invitation has channel and address
  then
    refuse INVITATION_ALREADY_CLAIMED "That invitation has already been used."

verify(invitation: Invitation, credential: String, channel: String) : return (invitation: Invitation, address: String)
  where invitation exists on channel, has no user, and credential matches
  then
    return invitation, address
  where no such unclaimed invitation matches
  then
    refuse INVITATION_INVALID "That invitation is not valid."

claim(invitation: Invitation, credential: String, user: User) : return (invitation: Invitation, channel: String, address: String)
  where invitation exists, has no user, and credential matches
  then
    set its user to user
    return invitation, channel, address
  where no such unclaimed invitation matches
  then
    refuse INVITATION_INVALID "That invitation is not valid."

retract(invitation: Invitation) : return ()
  where no such invitation exists
  then
    refuse INVITATION_NOT_FOUND "That invitation no longer exists."
  where invitation exists and has a user
  then
    refuse INVITATION_ALREADY_CLAIMED "That invitation has already been used."
  where invitation exists and has no user
  then
    delete the invitation
    return
```

## Queries

```queries
_getAvailable (invitation: String, credential: String) : optional (channel: String, address: String)
  answers the channel and address only while the Invitation is unclaimed and credential matches
  answers no row otherwise

_getInvitations () : many (invitation: String, channel: String, address: String, createdAt: Date, lastInvitedAt: Date, inviteCount: Number, user: User|Null)
  answers every Invitation without its credential
  orders rows by creation from newest to oldest
  answers no rows when none match
```
