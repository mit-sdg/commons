# Bookmarks

A logged-in user saves one live post with
[Forum.bookmarks.SaveBookmark](reaction:Forum.bookmarks.SaveBookmark). [Forum.bookmarks.UnsaveBookmark](reaction:Forum.bookmarks.UnsaveBookmark) removes only the caller's matching saved-post
record. Bookmarking refuses duplicate saves and repeated
removals. A missing or
trashed post is hidden as `NOT_FOUND` before either change.

The [readableBookmarksOf view](view:Forum.bookmarks.readableBookmarksOf) filters one account's retained bookmarks
through current post readability. [Forum.bookmarks.ListBookmarks](reaction:Forum.bookmarks.ListBookmarks) uses it to form
[the session account's readable bookmarks](former:Forum.bookmarks.theBookmarksOf), newest first.
For a read that needs post details rather than identities alone,
[theBookmarkedPostsOf](former:Forum.bookmarks.theBookmarkedPostsOf) adds each post's current summary without
copying that presentation into Bookmarking. [Forum.bookmarks.IsSaved](reaction:Forum.bookmarks.IsSaved) reports that account's status for one readable post;
it never exposes another user's private state.

Trash filters a bookmark without removing it, so restore makes it visible again.
After permanent purge, [Forum.bookmarks.PurgeClearsBookmarks](reaction:Forum.bookmarks.PurgeClearsBookmarks) removes the post
from every user's list. Ordinary Posting deletion requests the same idempotent
clear through post cleanup, and neither path can restore the bookmarks later.

```endpoints
Forum.bookmarks.IsSaved at /bookmarks/isSaved
Forum.bookmarks.ListBookmarks at /bookmarks/list
Forum.bookmarks.SaveBookmark at /bookmarks/save
Forum.bookmarks.UnsaveBookmark at /bookmarks/unsave
```
