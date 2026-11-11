# Starred discussions

Anyone signed in can star a discussion to find it again. Stars belong to the
Bookmarking instance registered as Starring, whose items are conversations, so
they are kept on the server for the account rather than in one browser, and
are separate from the post bookmarks on the Bookmarks page. Nobody else sees
another person's stars.

[Forum.stars.StarDiscussion](reaction:Forum.stars.StarDiscussion) stars a
conversation the caller can currently read, and
[Forum.stars.UnstarDiscussion](reaction:Forum.stars.UnstarDiscussion) removes
the caller's star. Both answer the resulting state, so starring twice or
unstarring something not starred succeeds without change. A conversation the
caller cannot read answers `NOT_FOUND` either way.

[Forum.stars.StarredDiscussions](reaction:Forum.stars.StarredDiscussions) forms
[the caller's starred discussions](former:Forum.stars.theStarsOf), newest star
first, through [readableStarsOf](view:Forum.stars.readableStarsOf), which keeps
only conversations the caller may still read. A star on a discussion whose
audience no longer admits the caller, or that is in the trash, stays stored but
is not answered; it comes back if access does. Purging the conversation removes
every star on it through
[Forum.stars.PurgeClearsStars](reaction:Forum.stars.PurgeClearsStars).

```endpoints
Forum.stars.StarDiscussion at /discussions/star
Forum.stars.StarredDiscussions at /discussions/starred
Forum.stars.UnstarDiscussion at /discussions/unstar
```
