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

All forum reads require an established audience. Existing installations with no discussions need no audience backfill; a conversation without grants remains inaccessible.

```endpoints
Forum.audiences.Preview at /audiences/preview
Forum.audiences.Options at /audiences/options
Forum.audiences.ForConversation at /audiences/forConversation
```
