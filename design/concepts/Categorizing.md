# Categorizing

## Purpose

Sort items into named categories within a scope. Each item belongs to at most
one category, so its home and each category's contents can be read directly,
and two scopes may each have a category of the same name without confusion.

Prevents: an item in two categories at once; two categories of one name in one scope; a merge leaving an item behind.

## Principle

Priya creates a Homework category in the course forum and assigns a quiz to
it. Assigning the quiz to Exams moves it there. Filing a lab under Labs in one
step reaches the Labs category or makes it, and puts the lab there. Unassigning it leaves it with
no category, and a second unassignment is refused. A second category named
Homework in the forum is also refused, and asking again for the category named
Homework reaches the one that already exists rather than making another — while
a Homework category in a different scope is simply another category. Renaming
Exams to Homework is refused for the same reason. She describes Exams in a
sentence so its contents are explained on sight. Finding that Tests and Exams
hold the same kind of thing, she merges Tests into Exams: every item of Tests
now lives in Exams and Tests is gone; merging a category into itself is
refused. Deleting Exams leaves every item in it uncategorized.

## Types

```types
external Scope
  An application-owned identity for the space a category's name is unique within.

external Item
  An application-owned identity used in the item role.
opaque Seq
  An ordered list of the values its argument names.
opaque CategoryWithItems
  One category as `{ category, name, description, items }`, its items in assignment order.
opaque ScopedCategory
  One category as `{ scope, category, name, description }`.
```

## State

```state
a set of Categories with
  a scope       Scope
  a name        String
  a description String

a set of Categorized with
  an item Item
  a home Category

Rule: at most one categorized entry has each item, so an item belongs to at most one category.
Rule: a category's name is unique within its scope; the same name in another scope names another category.
Rule: a category's scope is fixed when it is created.
Rule: deleting an empty category and assigning an item take effect in order; deletion cannot discard a concurrently assigned membership.
Rule: items and scopes are opaque identities; Categorizing neither creates nor validates them.
```

## Actions

```actions
createCategory(scope: Scope, name: String, description: String) : returns (category: Category)
  where no category in scope has this name
  then
    add a new category with scope, name, and description
    returns category
  where some category in scope has this name
  then
    refuses CATEGORY_ALREADY_EXISTS "A category with this name already exists."

ensureCategory(scope: Scope, name: String, description: String) : returns (category: Category)
  where some category in scope has this name
  then
    returns category
  where no category in scope has this name
  then
    add a new category with scope, name, and description
    returns category

renameCategory(category: Category, name: String) : returns (category: Category)
  where category in categories and no other category in its scope has this name
  then
    set category's name to name
    returns category
  where category not in categories
  then
    refuses CATEGORY_NOT_FOUND "There is no such category."
  where category in categories and another category in its scope has this name
  then
    refuses CATEGORY_ALREADY_EXISTS "A category with this name already exists."

describeCategory(category: Category, description: String) : returns (category: Category)
  where category in categories
  then
    set category's description to description
    returns category
  where category not in categories
  then
    refuses CATEGORY_NOT_FOUND "There is no such category."

mergeCategory(category: Category, into: Category) : returns (into: Category)
  where category and into are in categories, differ, and share a scope
  then
    set the home of every item whose home is category to into
    delete category
    returns into
  where category not in categories or into not in categories
  then
    refuses CATEGORY_NOT_FOUND "There is no such category."
  where category is into
  then
    refuses SAME_CATEGORY "A category cannot be merged into itself."
  where category and into do not share a scope
  then
    refuses DIFFERENT_SCOPES "These categories are not in the same scope."

file(scope: Scope, name: String, item: Item) : returns (category: Category)
  where some category in scope has this name
  then
    set item's home to that category, replacing any prior home
    returns category
  where no category in scope has this name
  then
    add a new category with scope, name, and an empty description
    set item's home to it, replacing any prior home
    returns category

assign(item: Item, category: Category) : returns (item: Item)
  where category in categories
  then
    set item's home to category, replacing any prior home
    returns item
  where category not in categories
  then
    refuses CATEGORY_NOT_FOUND "There is no such category."
unassign(item: Item) : returns (item: Item)
  where item in categorized
  then
    remove item from categorized
    returns item
  where item not in categorized
  then
    refuses ITEM_NOT_CATEGORIZED "This item is not in any category."
deleteEmptyCategory(category: Category) : returns (category: Category, deleted: Flag)
  where category exists and holds no items
  then
    delete category
    set deleted to true
    returns category, deleted
  where category does not exist or holds any item
  then
    leave categories and memberships unchanged
    set deleted to false
    returns category, deleted

empty(scope: Scope) : returns (emptied: Flag)
  where true
  then
    remove the memberships of every item in a category of scope
    leave the categories themselves unchanged
    set emptied to whether any membership was removed
    returns emptied

deleteEmptyCategories(categories: Seq<Category>) : returns (deleted: Flag)
  where true
  then
    for each category in categories, delete it only if it still exists and holds no items
    set deleted to whether any category was deleted
    returns deleted

deleteCategory(category: Category) : returns (category: Category)
  where category in categories
  then
    remove every item whose home is category from categorized
    delete category
    returns category
  where category not in categories
  then
    refuses CATEGORY_NOT_FOUND "There is no such category."
```

## Queries

```queries
_getCategory (item: String) : optional (category: String, name: String, description: String)
  answers the Category containing the Item with its name and description
  answers no row when the Item is uncategorized

_getCategoryDetail (category: String) : optional (scope: String, name: String, description: String)
  answers the Category's own scope, name, and description
  answers no row when the Category does not exist

_getHome (item: String) : optional (home: Category)
  answers the Category containing the Item under home
  answers no row when the Item is uncategorized

_getItems (category: String) : many (item: String)
  answers its items in assignment order
  answers no rows when none match

_categoriesIn (scope: String) : many (category: String, name: String, description: String)
  answers the scope's categories in creation order
  answers no rows when none match

_categoriesWithItems (scope: String) : one (categories: Seq<CategoryWithItems>)
  answers the scope's categories back as one value: an ordered sequence of
  `{ category, name, description, items }` entries in creation order, each
  items entry the category's items in assignment order
  answers an empty sequence when the scope has no categories

_categoriesInScopes (scopes: Seq<String>) : one (categories: Seq<ScopedCategory>)
  answers several scopes back as one value: an ordered sequence of
  `{ scope, category, name, description }` entries, each scope's categories in
  creation order, the scopes in the order given
  answers an empty sequence when the given sequence is empty or no scope has
  a category
```
