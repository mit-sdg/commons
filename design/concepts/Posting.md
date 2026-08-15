# Posting

## Purpose

Let an author create, edit, and delete a post while retaining its author and
creation time.

## Principle

On Monday Amara creates an announcement. On Wednesday she edits its content,
and the post records the edit time. On Friday she deletes it. Deleting it again
is refused because the post no longer exists.

## Types

```types
external Author
  An application-owned identity used in the author role.
```

## State

```state
a set of Posts with
  an author   Author
  a content   String
  a createdAt Date
  an optional editedAt Date
```

A post's content can name handles such as `@amara`. `_getMentions` answers each
distinct handle in first-appearance order. Handles are opaque strings; Posting
does not assign them to people.

## Actions

```actions
create(author: Author, content: String, at: Date) : return (post: Post)
  where true
  then
    add a new post with author, content, and createdAt at
    return post

edit(post: Post, content: String, at: Date) : return (post: Post)
  where post in posts
  then
    set the post's content to content, and its editedAt to at
    return post
  where post not in posts
  then
    refuse POST_NOT_FOUND "There is no such post."

delete(post: Post) : return (post: Post)
  where post in posts
  then
    delete post
    return post
  where post not in posts
  then
    refuse POST_NOT_FOUND "There is no such post."
```

## Queries

```queries
_getPost (post: String) : optional (author: String, content: String, createdAt: Date, editedAt: Date|Null)
  answers the complete Post
  answers no row when the Post does not exist

_getByAuthor (author: String) : many (post: String)
  answers the author's posts newest first
  answers no rows when none match

_getMentions (post: String) : many (handle: String)
  answers distinct handles in first-appearance order
  answers no rows when none match

_isMentioned (post: String, handle: String) : one (mentioned: Boolean)
  answers whether the Post's content contains the handle
```
