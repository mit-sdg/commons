# Categories

An administrator creates a unique named category through
[Forum.categories.CreateCategory](reaction:Forum.categories.CreateCategory). [Forum.categories.DeleteCategory](reaction:Forum.categories.DeleteCategory) removes one category definition and leaves
its posts uncategorized. Moderators use
[Forum.categories.AssignCategory](reaction:Forum.categories.AssignCategory) to give a live post one home, replacing any
previous home. [Forum.categories.UnassignCategory](reaction:Forum.categories.UnassignCategory) removes a readable post's current category
assignment.
Unauthorized changes return `FORBIDDEN`; a hidden post returns `NOT_FOUND`.

[Forum.categories.ListCategories](reaction:Forum.categories.ListCategories) makes every current category name and
description public. [Forum.categories.CategoryItems](reaction:Forum.categories.CategoryItems) returns all currently
readable posts in one category. [Forum.categories.CategoryForItem](reaction:Forum.categories.CategoryForItem) returns the
current category of one readable post. Trash hides a post from these reads while Categorizing retains the
assignment, so restore reveals it again.

Permanent purge triggers [Forum.categories.PurgeUnassignsCategory](reaction:Forum.categories.PurgeUnassignsCategory) only when
the post currently has a category. Ordinary author deletion does not trigger
that rule, so it can leave a Categorizing record that public post reads no
longer expose.

## Supporting declarations

Formers [theCategories](former:Forum.categories.theCategories), [theCategoryOf](former:Forum.categories.theCategoryOf), [theItemsIn](former:Forum.categories.theItemsIn) support the behavior and result shapes described above.
