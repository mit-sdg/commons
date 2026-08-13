# Posting

## Purpose

Let an author create, edit, and delete a post while retaining its author and
creation time.

## Principle

On Monday Amara creates an announcement. On Wednesday she edits its content,
and the post records the edit time. On Friday she deletes it. Deleting it again
is refused because the post no longer exists.

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

delete(post: Post) : return ()
  where post in posts
  then
    delete post
    return
  where post not in posts
  then
    refuse POST_NOT_FOUND "There is no such post."
```

## Queries

```queries
_getPost (post: String) : optional (author: String, content: String, createdAt: Date, editedAt: Date|Null)

_getByAuthor (author: String) : many (post: String)

_getMentions (post: String) : many (handle: String)

_isMentioned (post: String, handle: String) : one (mentioned: Boolean)
```

### Notes

- `_getPost (post)` answers at most one complete post.
- `_getByAuthor (author)` answers the author's posts newest first.
- `_getMentions (post)` answers distinct handles in first-appearance order.
- `_isMentioned (post, handle)` answers exactly one row with `mentioned`.
