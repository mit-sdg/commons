# Invitations

Only a caller holding `administer` can issue an invitation.
[Access.invitations.Invite](reaction:Access.invitations.Invite) resolves that caller from the session, verifies
that they hold `administer` and otherwise returns `FORBIDDEN`, normalizes the
email address, captures the current time, and asks Inviting to create or
resend its durable, single-use invitation. Normalizing trims the address and
lower-cases it, and refuses one that does not contain a single `@` as
`MAIL_RECIPIENT_INVALID`, the refusal Mailing's recipient normalization owns, so
an address invited twice in different spellings is one invitation. Resending the same
unclaimed address keeps the invitation and credential and increments its send
count; a claimed invitation is refused.

[The invitation for an address](view:Access.invitations.theInvitationFor) reads whether an address has
already been invited, so a caller that invites in bulk can leave existing
invitations untouched rather than resending them.

Each successful email invitation triggers
[Access.invitations.EmailInvitationQueuesMail](reaction:Access.invitations.EmailInvitationQueuesMail), which renders the
Commons-specific text and HTML and queues them in Mailing under the invitation
identity. Invitation state is already durable before this consequence runs, so a
rendering or queueing failure does not retract it. Once enqueue succeeds, an
SMTP failure leaves Mailing's message pending for a later attempt.

[Access.invitations.List](reaction:Access.invitations.List) gives administrators
[the current invitations](former:Access.invitations.theInvitations), including addresses,
timestamps, send counts, and claiming accounts. It never returns the temporary
credentials, and a non-administrator receives `FORBIDDEN` rather than the list.

An administrator can retract an unaccepted invitation.
[Access.invitations.Retract](reaction:Access.invitations.Retract) resolves the caller
from the session, verifies that the caller holds `administer`, and instructs
Inviting to delete the unclaimed invitation, permanently invalidating its
credential. A non-administrator receives `FORBIDDEN`, and attempting to retract
an unknown or already-claimed invitation is refused.

```endpoints
Access.invitations.Invite at /invitations/invite
Access.invitations.List at /invitations/list
Access.invitations.Retract at /invitations/retract
```
