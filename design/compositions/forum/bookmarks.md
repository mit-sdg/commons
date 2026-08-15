# Bookmarks

A logged-in user saves one live post with
[Forum.bookmarks.SaveBookmark](reaction:Forum.bookmarks.SaveBookmark). [Forum.bookmarks.UnsaveBookmark](reaction:Forum.bookmarks.UnsaveBookmark) removes only the caller's matching saved-post
record. Bookmarking refuses duplicate saves and repeated
removals. A missing or
trashed post is hidden as `NOT_FOUND` before either change.

[Forum.bookmarks.ListBookmarks](reaction:Forum.bookmarks.ListBookmarks) returns only the session account's readable
bookmarks, newest first. [Forum.bookmarks.IsSaved](reaction:Forum.bookmarks.IsSaved) reports that account's
status for one readable post; it never exposes another user's private state.

Trash filters a bookmark without removing it, so restore makes it visible again.
After permanent purge, [Forum.bookmarks.PurgeClearsBookmarks](reaction:Forum.bookmarks.PurgeClearsBookmarks) removes the post
from every user's list. Ordinary Posting deletion requests the same idempotent
clear through post cleanup, and neither path can restore the bookmarks later.

## Supporting declarations

Views [readableBookmarksOf](view:Forum.bookmarks.readableBookmarksOf) support the behavior and result shapes described above.

Formers [theBookmarkedPostsOf](former:Forum.bookmarks.theBookmarkedPostsOf), [theBookmarksOf](former:Forum.bookmarks.theBookmarksOf) support the behavior and result shapes described above.
