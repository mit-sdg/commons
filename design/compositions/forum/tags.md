# Tags

Any logged-in account creates a unique shared label through
[Forum.tags.CreateTag](reaction:Forum.tags.CreateTag). [Forum.tags.AddTag](reaction:Forum.tags.AddTag) applies an existing label to a
readable post. [Forum.tags.RemoveTag](reaction:Forum.tags.RemoveTag) removes that tag application from the readable post. No
administrator or moderator capability is required. Tagging retains its own
unknown-tag, duplicate-application, and missing-application refusals, while a
missing or trashed post is hidden as `NOT_FOUND`.

[Forum.tags.ListTags](reaction:Forum.tags.ListTags) makes every current tag identity and name public.
[Forum.tags.TagsForTarget](reaction:Forum.tags.TagsForTarget) returns a readable post's applied tags in order.
[Forum.tags.TagTargets](reaction:Forum.tags.TagTargets) returns every readable post carrying a supplied tag
identity.
[Forum.tags.TagTargetsByName](reaction:Forum.tags.TagTargetsByName) performs the target lookup from an exact tag
name.
Trash filters those post results but keeps the applications, so restore reveals
them again.

After permanent post purge, [Forum.tags.PurgeClearsTags](reaction:Forum.tags.PurgeClearsTags) removes every tag
application on that post. Ordinary
Posting deletion asks Tagging for the same idempotent clear through post cleanup.
Commons offers no operation that deletes an entire tag definition.

## Supporting declarations

Formers [theTags](former:Forum.tags.theTags), [theTagsOn](former:Forum.tags.theTagsOn), [theTargetsTagged](former:Forum.tags.theTargetsTagged), [theTargetsTaggedWithName](former:Forum.tags.theTargetsTaggedWithName) support the behavior and result shapes described above.
