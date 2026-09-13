# Audiences

[Options](reaction:Forum.audiences.Options) derives the account from its session
and forms [the current choices](former:Forum.audiences.theOptions) of people,
groups, sections, and standing audiences.
Course departure or archival prevents new addressing. The picker and publication
validation share the addressable-holder view; presentation never changes a
submitted choice silently.

[ForConversation](reaction:Forum.audiences.ForConversation) returns the complete
[explicit holders](former:Forum.audiences.theAudience) only through
[the current reader admission](view:Forum.audiences.audienceReader). Unknown and inaccessible
conversations both return NOT_FOUND. [Holder presentation](former:Forum.audiences.theHolder) includes its kind and
stable identity, so equal group titles stay distinguishable, and never includes
a group's roster. A missing holder name is explicitly unavailable.

[Preview](reaction:Forum.audiences.Preview) returns [the final explicit selection](view:Forum.audiences.previewAudience)
using the same current addressing policy as publication. It includes the sender
when a person is selected or when the collective choices do not already admit
them. An invalid or no-longer-addressable selection refuses in full. The returned
identities are shown before submission; publication validates that exact set
without silently adding or removing holders.

Administrators holding `administer` may read all established discussions, including
private discussions addressed to other people, groups, or sections. This is a
read-access exception, not audience membership: it never changes the selected
holders, joins a group, or expands the choices someone may address. The audience
preview still includes the sender under its existing rules. Audience labels show
only the explicit selection, without a separate administrator-access annotation.
Existing discussions gain this access without a backfill; a conversation without
grants remains inaccessible to everyone, including administrators.

```endpoints
Forum.audiences.Preview at /audiences/preview
Forum.audiences.Options at /audiences/options
Forum.audiences.ForConversation at /audiences/forConversation
```

Established conversation admission
requires a current usable account, an established audience, the owning conversation
record, and either current audience membership or the current `administer`
capability. Other staff and moderators receive no exception. Revoking administration
removes its extra access on the next read, and archival denies even an administrator. Conversation-only reads additionally require some stored
post in that conversation. Post-specific reads instead verify their own placement
and Posting record; that post supplies the existence witness without enumerating
the entire thread again. Ordinary reads also reject trashed posts, while stored
post inspection retains its existing moderation policy. Retained grants or nodes
alone never admit an absent conversation or absent post. The shared admission applies
to feeds, thread and post reads, related metadata, notifications, and actions that
require discussion access. Independent restrictions still apply: administration
does not grant another author's edit permission, bypass a conversation lock, or
expose trash through an ordinary post read.
