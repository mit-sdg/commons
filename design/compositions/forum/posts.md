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

[Forum.posts.GetPost](reaction:Forum.posts.GetPost) publicly returns one readable post with its rendered
content and reports a missing or trashed post as `NOT_FOUND`.
[Forum.posts.PostsByAuthor](reaction:Forum.posts.PostsByAuthor) returns the author's current untrashed post
identities without requiring a session.

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

## Supporting declarations

Views [notReadable](view:Forum.posts.notReadable), [publicPostsBy](view:Forum.posts.publicPostsBy), [readable](view:Forum.posts.readable) support the behavior and result shapes described above.

Formers [thePost](former:Forum.posts.thePost), [thePublicPostsOf](former:Forum.posts.thePublicPostsOf) support the behavior and result shapes described above.
