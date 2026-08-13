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

Inviting does not interpret channels or addresses. A composition chooses the
channel and delegates validation, normalization, and delivery to the concept
that owns that channel.

## State

```state
a set of Invitations with
  a channel            String
  an address            String
  a createdAt          Date
  a lastInvitedAt      Date
  an inviteCount       Number
  an optional user     String
```

An invitation has no expiry. A credential is derived from the
invitation identifier with a deployment secret; it is stable but is never
stored by Inviting.

## Actions

```actions
invite(channel: String, address: String, at: Date) : return (invitation: Invitation, channel: String, address: String, credential: String, created: Boolean)
  where no invitation has channel and address
  then
    add a new invitation with createdAt and lastInvitedAt at, inviteCount 1, and no user
    return invitation, channel, address, its derived credential, and true
  where an unclaimed invitation has channel and address
  then
    set its lastInvitedAt to at and increment its inviteCount
    return that invitation, channel, address, its unchanged derived credential, and false
  where a claimed invitation has channel and address
  then
    refuse INVITATION_ALREADY_CLAIMED "That invitation has already been used."

verify(invitation: Invitation, credential: String, channel: String) : return (invitation: Invitation, address: String)
  where invitation exists on channel, has no user, and credential matches
  then
    return invitation and its address
  where no such unclaimed invitation matches
  then
    refuse INVITATION_INVALID "That invitation is not valid."

claim(invitation: Invitation, credential: String, user: String) : return (invitation: Invitation, channel: String, address: String)
  where invitation exists, has no user, and credential matches
  then
    set its user to user
    return invitation, channel, and address
  where no such unclaimed invitation matches
  then
    refuse INVITATION_INVALID "That invitation is not valid."
```

## Queries

```queries
_getAvailable (invitation: String, credential: String) : optional (channel: String, address: String)
_getInvitations () : many (invitation: String, channel: String, address: String, createdAt: Date, lastInvitedAt: Date, inviteCount: Number, user: String|Null)
```

### Notes

- `_getAvailable` returns the channel and address only for an unclaimed
  invitation whose credential matches.
- `_getInvitations` never returns a credential.
