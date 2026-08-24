# Tags

Any logged-in account creates a unique shared label through
[Forum.tags.CreateTag](reaction:Forum.tags.CreateTag). [Forum.tags.AddTag](reaction:Forum.tags.AddTag) applies an existing label to a
readable post. [Forum.tags.RemoveTag](reaction:Forum.tags.RemoveTag) removes that tag application from the readable post. None
of these checks a capability at all: what may be tagged depends only on whether
the post is readable, and moderation governs that elsewhere. Tagging retains its own
unknown-tag, duplicate-application, and missing-application refusals, while a
missing or trashed post is hidden as `NOT_FOUND`.

[Forum.tags.ListTags](reaction:Forum.tags.ListTags) forms
[the public tag catalog](former:Forum.tags.theTags) from every current tag identity and name.
[Forum.tags.TagsForTarget](reaction:Forum.tags.TagsForTarget) forms
[a readable post's applied tags](former:Forum.tags.theTagsOn) in order.
[Forum.tags.TagTargets](reaction:Forum.tags.TagTargets) forms
[the readable targets carrying a supplied tag](former:Forum.tags.theTargetsTagged).
[Forum.tags.TagTargetsByName](reaction:Forum.tags.TagTargetsByName) forms
[the same readable targets from an exact tag name](former:Forum.tags.theTargetsTaggedWithName).
Trash filters those post results but keeps the applications, so restore reveals
them again.

After permanent post purge, [Forum.tags.PurgeClearsTags](reaction:Forum.tags.PurgeClearsTags) removes every tag
application on that post. Ordinary
Posting deletion asks Tagging for the same idempotent clear through post cleanup.
Commons offers no operation that deletes an entire tag definition.

```endpoints
Forum.tags.AddTag at /tags/add
Forum.tags.CreateTag at /tags/create
Forum.tags.ListTags at /tags/list
Forum.tags.RemoveTag at /tags/remove
Forum.tags.TagTargets at /tags/targets
Forum.tags.TagTargetsByName at /tags/targetsByName
Forum.tags.TagsForTarget at /tags/forTarget
```
