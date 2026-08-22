# Categories

An administrator creates a unique named category through
[Forum.categories.CreateCategory](reaction:Forum.categories.CreateCategory). [Forum.categories.DeleteCategory](reaction:Forum.categories.DeleteCategory) removes one category definition and leaves
its posts uncategorized. Moderators use
[Forum.categories.AssignCategory](reaction:Forum.categories.AssignCategory) to give a live post one home, replacing any
previous home. [Forum.categories.UnassignCategory](reaction:Forum.categories.UnassignCategory) removes a readable post's current category
assignment.
Unauthorized changes return `FORBIDDEN`; a hidden post returns `NOT_FOUND`.

[Forum.categories.ListCategories](reaction:Forum.categories.ListCategories) forms
[the current category catalog](former:Forum.categories.theCategories) as public names and descriptions.
[Forum.categories.CategoryItems](reaction:Forum.categories.CategoryItems) forms
[the readable posts in one category](former:Forum.categories.theItemsIn).
[Forum.categories.CategoryForItem](reaction:Forum.categories.CategoryForItem) forms
[the current category of one readable post](former:Forum.categories.theCategoryOf). Trash hides a post from these reads while Categorizing retains the
assignment, so restore reveals it again.

Permanent purge triggers [Forum.categories.PurgeUnassignsCategory](reaction:Forum.categories.PurgeUnassignsCategory) only when
the post currently has a category. Ordinary author deletion does not trigger
that rule, so it can leave a Categorizing record that public post reads no
longer expose.

```endpoints
Forum.categories.AssignCategory at /categories/assign
Forum.categories.CategoryForItem at /categories/forItem
Forum.categories.CategoryItems at /categories/items
Forum.categories.CreateCategory at /categories/create
Forum.categories.DeleteCategory at /categories/delete
Forum.categories.ListCategories at /categories/list
Forum.categories.UnassignCategory at /categories/unassign
```
