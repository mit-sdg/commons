# Posts

Every successful Posting creation triggers
[Forum.posts.CreatedPostRefreshesDerivedContent](reaction:Forum.posts.CreatedPostRefreshesDerivedContent), which renders the source and
replaces its parsed links. This applies both to posts placed in conversations
and to assignment submission artifacts. Rendering and linking are sibling
follow-ups; a fault leaves the post created and may leave only part of its
derived state. Revision behavior reacts to the same creation separately.

An author changes a post through [Forum.posts.EditPost](reaction:Forum.posts.EditPost) only while it exists,
is not trashed, and belongs to an unlocked conversation. The successful edit
then triggers [Forum.posts.EditedPostRefreshesDerivedContent](reaction:Forum.posts.EditedPostRefreshesDerivedContent), replacing its
rendered HTML and links, while revision and mention rules independently append
history and notify newly mentioned users. Posting's edit remains committed if a
follow-up fails.

The [readable view](view:Forum.posts.readable) recognizes posts that belong to a forum conversation, retain Posting state, and have no trash marker;
its complement is [notReadable](view:Forum.posts.notReadable).
[Forum.posts.GetPost](reaction:Forum.posts.GetPost) uses that decision to form
[one post with its rendered content](former:Forum.posts.thePost), reporting a missing, trashed, or non-forum post as `NOT_FOUND`. Assignment artifacts use their owner-or-grader read instead.
The [publicPostsBy view](view:Forum.posts.publicPostsBy) selects an author's readable posts, and
[Forum.posts.PostsByAuthor](reaction:Forum.posts.PostsByAuthor) returns
[those current forum post identities](former:Forum.posts.thePublicPostsOf) without requiring a session in the composition.

[Forum.posts.DeletePost](reaction:Forum.posts.DeletePost) permits only the author of a live post whose
conversation node has no replies. A parent returns `POST_HAS_REPLIES`. When the author requests deletion of an
unplaced submission artifact, no declared result path matches, so the request
times out without deleting the artifact. Once Posting deletes the
record, [Forum.posts.DeletedPostClearsSatellites](reaction:Forum.posts.DeletedPostClearsSatellites) clears formatting, reactions,
pins, bookmarks, tags, unread registration, forward and backward links, and the
leaf node. That cleanup does not include revision history, notifications,
categories, or accepted-answer state; moderation purge has separate rules for
those owners. The delete and cleanup are not transactional, so a failed cleanup
can leave state that public post reads no longer expose.

```endpoints
Forum.posts.DeletePost at /posts/delete
Forum.posts.EditPost at /posts/edit
Forum.posts.GetPost at /posts/get
Forum.posts.PostsByAuthor at /posts/byAuthor
```
